#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="${REPO_ROOT}"
ENV_FILE="${APP_DIR}/.env.production"
FRONTEND_ENV_FILE="${APP_DIR}/frontend/.env.production"
APP_USER="produtos"
DOMAIN=""
EMAIL=""
ADMIN_USER=""
ADMIN_PASSWORD=""
DB_NAME="b2b_gateway"
DB_USER="produtos"
DB_PASSWORD=""
SKIP_CERTBOT="false"

usage() {
  cat <<'EOF'
Uso:
  sudo bash deploy/ubuntu/install.sh \
    --domain app.seudominio.com \
    --email ops@seudominio.com \
    --admin-user admin \
    --admin-password 'senha-forte' \
    --db-password 'senha-db-forte'

Opcoes:
  --domain            DNS publico apontando para a VPS
  --email             Email do Let's Encrypt
  --admin-user        Usuario do Basic Auth do painel admin
  --admin-password    Senha do Basic Auth do painel admin
  --db-password       Senha do usuario PostgreSQL local
  --app-dir           Caminho do projeto na VPS (default: repo atual)
  --env-file          Caminho do .env.production (default: <app-dir>/.env.production)
  --db-name           Nome do banco PostgreSQL local (default: b2b_gateway)
  --db-user           Usuario PostgreSQL local (default: produtos)
  --skip-certbot      Pula emissao do SSL e deixa apenas HTTP
  -h, --help          Mostra esta ajuda
EOF
}

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  printf '\n[ERRO] %s\n' "$*" >&2
  exit 1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "Execute este instalador como root."
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)
        DOMAIN="$2"
        shift 2
        ;;
      --email)
        EMAIL="$2"
        shift 2
        ;;
      --admin-user)
        ADMIN_USER="$2"
        shift 2
        ;;
      --admin-password)
        ADMIN_PASSWORD="$2"
        shift 2
        ;;
      --db-password)
        DB_PASSWORD="$2"
        shift 2
        ;;
      --db-name)
        DB_NAME="$2"
        shift 2
        ;;
      --db-user)
        DB_USER="$2"
        shift 2
        ;;
      --app-dir)
        APP_DIR="$2"
        shift 2
        ;;
      --env-file)
        ENV_FILE="$2"
        shift 2
        ;;
      --skip-certbot)
        SKIP_CERTBOT="true"
        shift 1
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Opcao desconhecida: $1"
        ;;
    esac
  done
}

ensure_ubuntu_2404() {
  [[ -f /etc/os-release ]] || fail "Nao foi possivel identificar o sistema operacional."
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${ID}" == "ubuntu" ]] || fail "Este instalador suporta apenas Ubuntu."
  [[ "${VERSION_ID}" == "24.04" ]] || fail "Este instalador foi preparado para Ubuntu 24.04."
}

apt_install_if_missing() {
  local package
  local packages_to_install=()
  for package in "$@"; do
    if ! dpkg -s "${package}" >/dev/null 2>&1; then
      packages_to_install+=("${package}")
    fi
  done

  if [[ "${#packages_to_install[@]}" -gt 0 ]]; then
    log "Instalando pacotes: ${packages_to_install[*]}"
    apt-get install -y "${packages_to_install[@]}"
  fi
}

ensure_base_packages() {
  log "Atualizando indice do apt"
  apt-get update -y

  apt_install_if_missing \
    curl \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    build-essential \
    nginx \
    certbot \
    python3-certbot-nginx \
    postgresql \
    postgresql-contrib \
    redis-server \
    apache2-utils \
    dnsutils
}

ensure_node_22() {
  if command -v node >/dev/null 2>&1; then
    local node_major
    node_major="$(node -p 'process.versions.node.split(".")[0]')"
    if [[ "${node_major}" == "22" ]]; then
      log "Node.js 22 ja instalado"
      return
    fi
  fi

  log "Instalando Node.js 22 via NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

ensure_services_running() {
  systemctl enable --now postgresql
  systemctl enable --now redis-server
  systemctl enable --now nginx
}

ensure_app_user() {
  if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    log "Criando usuario de sistema ${APP_USER}"
    useradd --system --create-home --shell /usr/sbin/nologin "${APP_USER}"
  fi
}

ensure_env_files() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    log "Criando ${ENV_FILE} a partir de .env.production.example"
    cp "${APP_DIR}/.env.production.example" "${ENV_FILE}"
  fi

  if [[ ! -f "${FRONTEND_ENV_FILE}" ]]; then
    log "Criando ${FRONTEND_ENV_FILE} para build de producao"
    cp "${APP_DIR}/frontend/.env.production.example" "${FRONTEND_ENV_FILE}"
  fi
}

write_frontend_env() {
  cat > "${FRONTEND_ENV_FILE}" <<EOF
VITE_API_BASE_URL=
VITE_ADMIN_TOKEN=
EOF
}

generate_secret() {
  openssl rand -hex 32
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -q "^${key}=" "${file}"; then
    sed -i "s#^${key}=.*#${key}=${value}#g" "${file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${file}"
  fi
}

read_env_value() {
  local file="$1"
  local key="$2"
  awk -F= -v key="${key}" '$1 == key {print substr($0, index($0,$2))}' "${file}" | tail -n1
}

ensure_required_env() {
  local api_key_pepper
  local webhook_secret
  local admin_token
  local admin_session_secret
  api_key_pepper="$(read_env_value "${ENV_FILE}" "API_KEY_PEPPER")"
  webhook_secret="$(read_env_value "${ENV_FILE}" "INTERNAL_WEBHOOK_SECRET")"
  admin_token="$(read_env_value "${ENV_FILE}" "ADMIN_TOKEN")"
  admin_session_secret="$(read_env_value "${ENV_FILE}" "ADMIN_SESSION_SECRET")"

  [[ -n "${DB_PASSWORD}" ]] || fail "Informe --db-password para criar o PostgreSQL local."
  [[ -n "${DOMAIN}" ]] || fail "Informe --domain."
  [[ -n "${EMAIL}" ]] || fail "Informe --email."
  [[ -n "${ADMIN_USER}" ]] || fail "Informe --admin-user."
  [[ -n "${ADMIN_PASSWORD}" ]] || fail "Informe --admin-password."

  [[ -n "${api_key_pepper}" && "${api_key_pepper}" != "generate-a-long-secret-value" ]] || \
    upsert_env_var "${ENV_FILE}" "API_KEY_PEPPER" "$(generate_secret)"
  [[ -n "${webhook_secret}" && "${webhook_secret}" != "generate-a-long-secret-value" ]] || \
    upsert_env_var "${ENV_FILE}" "INTERNAL_WEBHOOK_SECRET" "$(generate_secret)"
  [[ -n "${admin_token}" && "${admin_token}" != "generate-a-long-secret-value" ]] || \
    upsert_env_var "${ENV_FILE}" "ADMIN_TOKEN" "$(generate_secret)"
  [[ -n "${admin_session_secret}" && "${admin_session_secret}" != "generate-a-long-secret-value" ]] || \
    upsert_env_var "${ENV_FILE}" "ADMIN_SESSION_SECRET" "$(generate_secret)"

  upsert_env_var "${ENV_FILE}" "NODE_ENV" "production"
  upsert_env_var "${ENV_FILE}" "PORT" "3000"
  upsert_env_var "${ENV_FILE}" "DATABASE_URL" "postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
  upsert_env_var "${ENV_FILE}" "REDIS_URL" "redis://127.0.0.1:6379"
  upsert_env_var "${ENV_FILE}" "ADMIN_USERNAME" ""
  upsert_env_var "${ENV_FILE}" "ADMIN_PASSWORD" ""

  local supabase_url
  local supabase_key
  supabase_url="$(read_env_value "${ENV_FILE}" "SUPABASE_URL")"
  supabase_key="$(read_env_value "${ENV_FILE}" "SUPABASE_SERVICE_ROLE_KEY")"

  [[ -n "${supabase_url}" && "${supabase_url}" != "https://your-project.supabase.co" ]] || \
    fail "Preencha SUPABASE_URL em ${ENV_FILE}."
  [[ -n "${supabase_key}" && "${supabase_key}" != "your-service-role-key" ]] || \
    fail "Preencha SUPABASE_SERVICE_ROLE_KEY em ${ENV_FILE}."
}

ensure_postgres_db() {
  log "Garantindo usuario e banco PostgreSQL locais"
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"

  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
}

install_node_dependencies() {
  log "Instalando dependencias do backend"
  cd "${APP_DIR}"
  npm install

  log "Instalando dependencias do frontend"
  cd "${APP_DIR}/frontend"
  npm install
}

build_application() {
  log "Gerando build do backend"
  cd "${APP_DIR}"
  npm run build

  log "Gerando build do frontend"
  cd "${APP_DIR}/frontend"
  npm run build
}

run_migrations() {
  log "Aplicando migracoes locais"
  cd "${APP_DIR}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  npm run prisma:migrate:deploy
}

render_template() {
  local source_file="$1"
  local target_file="$2"
  shift 2

  cp "${source_file}" "${target_file}"
  while [[ $# -gt 0 ]]; do
    local key="$1"
    local value="$2"
    sed -i "s#__${key}__#${value//\/\\/}#g" "${target_file}"
    shift 2
  done
}

install_systemd_service() {
  local service_file="/etc/systemd/system/produtos-api.service"
  render_template \
    "${APP_DIR}/deploy/ubuntu/templates/produtos-api.service.template" \
    "${service_file}" \
    APP_USER "${APP_USER}" \
    APP_DIR "${APP_DIR}" \
    ENV_FILE "${ENV_FILE}"

  systemctl daemon-reload
  systemctl enable produtos-api.service
  systemctl restart produtos-api.service
}

install_nginx_config() {
  local admin_token
  admin_token="$(read_env_value "${ENV_FILE}" "ADMIN_TOKEN")"
  local nginx_file="/etc/nginx/sites-available/produtos.conf"
  local auth_file="/etc/nginx/.produtos-admin.htpasswd"

  mkdir -p /var/www/certbot
  htpasswd -bc "${auth_file}" "${ADMIN_USER}" "${ADMIN_PASSWORD}" >/dev/null

  render_template \
    "${APP_DIR}/deploy/ubuntu/templates/nginx-produtos.conf.template" \
    "${nginx_file}" \
    DOMAIN "${DOMAIN}" \
    ADMIN_AUTH_FILE "${auth_file}" \
    ADMIN_TOKEN "${admin_token}" \
    FRONTEND_DIST_DIR "${APP_DIR}/frontend/dist"

  ln -sf "${nginx_file}" /etc/nginx/sites-enabled/produtos.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
}

ensure_dns_points_to_server() {
  if [[ "${SKIP_CERTBOT}" == "true" ]]; then
    return
  fi

  local public_ip
  local dns_ip
  public_ip="$(curl -fsSL https://api.ipify.org)"
  dns_ip="$(dig +short A "${DOMAIN}" | tail -n1)"

  [[ -n "${dns_ip}" ]] || fail "O dominio ${DOMAIN} ainda nao resolve para nenhum IP."
  [[ "${dns_ip}" == "${public_ip}" ]] || \
    fail "O dominio ${DOMAIN} resolve para ${dns_ip}, mas esta VPS responde como ${public_ip}. Ajuste o DNS antes do SSL."
}

install_ssl() {
  if [[ "${SKIP_CERTBOT}" == "true" ]]; then
    log "SSL pulado por --skip-certbot"
    return
  fi

  log "Emitindo certificado SSL para ${DOMAIN}"
  certbot --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    -m "${EMAIL}" \
    -d "${DOMAIN}"
}

fix_permissions() {
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
}

main() {
  parse_args "$@"
  require_root
  ensure_ubuntu_2404
  ensure_base_packages
  ensure_node_22
  ensure_services_running
  ensure_app_user
  ensure_env_files
  write_frontend_env
  ensure_required_env
  ensure_postgres_db
  install_node_dependencies
  build_application
  run_migrations
  fix_permissions
  install_systemd_service
  install_nginx_config
  ensure_dns_points_to_server
  install_ssl

  log "Instalacao concluida"
  log "Painel admin: https://${DOMAIN}/"
  log "Login do painel: token unico definido em ADMIN_TOKEN no arquivo ${ENV_FILE}"
  log "API publica: https://${DOMAIN}/api/v1/products"
  log "Webhook interno: https://${DOMAIN}/api/internal/webhooks/supabase-sync"
}

main "$@"

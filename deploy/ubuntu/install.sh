#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

APP_DIR="${REPO_ROOT}"
ENV_FILE=""
FRONTEND_ENV_FILE=""

APP_USER="produtos"
DOMAIN=""
EMAIL=""
DB_NAME="b2b_gateway"
DB_USER="produtos"
DB_PASSWORD=""
APP_PORT="3000"
SKIP_CERTBOT="false"
ACTION=""

usage() {
  cat <<'EOF'
Uso:
  sudo bash deploy/ubuntu/install.sh --action install \
    --domain app.seudominio.com \
    --email ops@seudominio.com \
    --app-port 3000 \
    --db-password 'senha-db-forte'

  sudo bash deploy/ubuntu/install.sh --action update

  sudo bash deploy/ubuntu/install.sh --action change-domain \
    --domain app-novo.seudominio.com \
    --email ops@seudominio.com

Sem --action o script abre um menu:
  1) Instalar
  2) Atualizar
  3) Alterar dominio e SSL

Opcoes:
  --action            install | update | change-domain
  --domain            Dominio publico da aplicacao
  --email             Email do Let's Encrypt
  --app-port          Porta local do backend Fastify
  --db-password       Senha do usuario PostgreSQL local
  --app-dir           Caminho do projeto na VPS
  --env-file          Caminho do .env.production
  --db-name           Nome do banco PostgreSQL local
  --db-user           Usuario PostgreSQL local
  --skip-certbot      Pula emissao/renovacao do SSL
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
  [[ "${EUID}" -eq 0 ]] || fail "Execute este script como root."
}

refresh_paths() {
  [[ -n "${APP_DIR}" ]] || fail "APP_DIR vazio."
  [[ -n "${ENV_FILE}" ]] || ENV_FILE="${APP_DIR}/.env.production"
  FRONTEND_ENV_FILE="${APP_DIR}/frontend/.env.production"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --action)
        ACTION="$2"
        shift 2
        ;;
      --domain)
        DOMAIN="$2"
        shift 2
        ;;
      --email)
        EMAIL="$2"
        shift 2
        ;;
      --db-password)
        DB_PASSWORD="$2"
        shift 2
        ;;
      --app-port)
        APP_PORT="$2"
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

choose_action_interactively() {
  if [[ -n "${ACTION}" ]]; then
    return
  fi

  [[ -t 0 ]] || fail "Informe --action em execucao nao interativa."

  cat <<'EOF'

Selecione a operacao:
  1) Instalar
  2) Atualizar
  3) Alterar dominio e SSL
EOF

  local selected
  read -r -p "Opcao [1-3]: " selected

  case "${selected}" in
    1) ACTION="install" ;;
    2) ACTION="update" ;;
    3) ACTION="change-domain" ;;
    *) fail "Opcao invalida: ${selected}" ;;
  esac
}

prompt_value_if_empty() {
  local variable_name="$1"
  local prompt_label="$2"
  local secret="${3:-false}"
  local current_value="${!variable_name:-}"

  if [[ -n "${current_value}" ]]; then
    return
  fi

  [[ -t 0 ]] || fail "Informe ${prompt_label} por argumento."

  local next_value=""
  if [[ "${secret}" == "true" ]]; then
    read -r -s -p "${prompt_label}: " next_value
    printf '\n'
  else
    read -r -p "${prompt_label}: " next_value
  fi

  [[ -n "${next_value}" ]] || fail "${prompt_label} nao pode ficar vazio."
  printf -v "${variable_name}" '%s' "${next_value}"
}

ensure_ubuntu_2404() {
  [[ -f /etc/os-release ]] || fail "Nao foi possivel identificar o sistema operacional."
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${ID}" == "ubuntu" ]] || fail "Este script suporta apenas Ubuntu."
  [[ "${VERSION_ID}" == "24.04" ]] || fail "Este script foi preparado para Ubuntu 24.04."
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
VITE_PRODUCT_IMAGE_BASE_URL=https://estoque-joias-b2b-gold.s3.us-east-2.amazonaws.com
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

extract_domain_from_url() {
  local url="$1"
  printf '%s' "${url}" | sed -E 's#^https?://##; s#/.*$##'
}

load_runtime_defaults_from_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    return
  fi

  local env_port
  env_port="$(read_env_value "${ENV_FILE}" "PORT")"
  if [[ -n "${env_port}" && "${APP_PORT}" == "3000" ]]; then
    APP_PORT="${env_port}"
  fi

  if [[ -z "${DOMAIN}" ]]; then
    local current_public_url
    current_public_url="$(read_env_value "${ENV_FILE}" "PUBLIC_BASE_URL")"
    if [[ -n "${current_public_url}" ]]; then
      DOMAIN="$(extract_domain_from_url "${current_public_url}")"
    fi
  fi
}

ensure_install_inputs() {
  prompt_value_if_empty DOMAIN "Dominio publico"
  prompt_value_if_empty EMAIL "Email do Let's Encrypt"
  prompt_value_if_empty DB_PASSWORD "Senha do PostgreSQL local" "true"

  [[ "${APP_PORT}" =~ ^[0-9]+$ ]] || fail "--app-port deve ser numerico."
}

ensure_change_domain_inputs() {
  prompt_value_if_empty DOMAIN "Novo dominio publico"
  prompt_value_if_empty EMAIL "Email do Let's Encrypt"

  [[ "${APP_PORT}" =~ ^[0-9]+$ ]] || fail "--app-port deve ser numerico."
}

ensure_required_env_for_install() {
  local api_key_pepper
  local webhook_secret
  local admin_token
  local admin_session_secret
  local supabase_url
  local supabase_key

  api_key_pepper="$(read_env_value "${ENV_FILE}" "API_KEY_PEPPER")"
  webhook_secret="$(read_env_value "${ENV_FILE}" "INTERNAL_WEBHOOK_SECRET")"
  admin_token="$(read_env_value "${ENV_FILE}" "ADMIN_TOKEN")"
  admin_session_secret="$(read_env_value "${ENV_FILE}" "ADMIN_SESSION_SECRET")"

  [[ -n "${api_key_pepper}" && "${api_key_pepper}" != "generate-a-long-secret-value" ]] || \
    upsert_env_var "${ENV_FILE}" "API_KEY_PEPPER" "$(generate_secret)"
  [[ -n "${webhook_secret}" && "${webhook_secret}" != "generate-a-long-secret-value" ]] || \
    upsert_env_var "${ENV_FILE}" "INTERNAL_WEBHOOK_SECRET" "$(generate_secret)"
  [[ -n "${admin_token}" && "${admin_token}" != "generate-a-long-secret-value" ]] || \
    upsert_env_var "${ENV_FILE}" "ADMIN_TOKEN" "$(generate_secret)"
  [[ -n "${admin_session_secret}" && "${admin_session_secret}" != "generate-a-long-secret-value" ]] || \
    upsert_env_var "${ENV_FILE}" "ADMIN_SESSION_SECRET" "$(generate_secret)"

  upsert_env_var "${ENV_FILE}" "NODE_ENV" "production"
  upsert_env_var "${ENV_FILE}" "PORT" "${APP_PORT}"
  upsert_env_var "${ENV_FILE}" "PUBLIC_BASE_URL" "https://${DOMAIN}"
  upsert_env_var "${ENV_FILE}" "DATABASE_URL" "postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
  upsert_env_var "${ENV_FILE}" "REDIS_URL" "redis://127.0.0.1:6379"
  upsert_env_var "${ENV_FILE}" "ADMIN_USERNAME" ""
  upsert_env_var "${ENV_FILE}" "ADMIN_PASSWORD" ""

  supabase_url="$(read_env_value "${ENV_FILE}" "SUPABASE_URL")"
  supabase_key="$(read_env_value "${ENV_FILE}" "SUPABASE_SERVICE_ROLE_KEY")"

  [[ -n "${supabase_url}" && "${supabase_url}" != "https://your-project.supabase.co" ]] || \
    fail "Preencha SUPABASE_URL em ${ENV_FILE}."
  [[ -n "${supabase_key}" && "${supabase_key}" != "your-service-role-key" ]] || \
    fail "Preencha SUPABASE_SERVICE_ROLE_KEY em ${ENV_FILE}."
}

prepare_existing_env_for_runtime() {
  [[ -f "${ENV_FILE}" ]] || fail "Arquivo ${ENV_FILE} nao encontrado."

  upsert_env_var "${ENV_FILE}" "NODE_ENV" "production"
  upsert_env_var "${ENV_FILE}" "PORT" "${APP_PORT}"
}

update_public_base_url() {
  [[ -n "${DOMAIN}" ]] || fail "Dominio vazio para atualizar PUBLIC_BASE_URL."
  upsert_env_var "${ENV_FILE}" "PUBLIC_BASE_URL" "https://${DOMAIN}"
}

ensure_backend_port_available() {
  if systemctl list-unit-files | grep -q '^produtos-api.service'; then
    systemctl stop produtos-api.service >/dev/null 2>&1 || true
  fi

  if ss -ltnp "( sport = :${APP_PORT} )" | grep -q LISTEN; then
    log "Porta ${APP_PORT} ja esta em uso:"
    ss -ltnp "( sport = :${APP_PORT} )" || true
    fail "Libere a porta ${APP_PORT} ou ajuste PORT no ${ENV_FILE}."
  fi
}

ensure_postgres_db() {
  log "Garantindo usuario e banco PostgreSQL locais"
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"

  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
}

update_source_code() {
  if [[ ! -d "${APP_DIR}/.git" ]]; then
    log "Repositorio git nao encontrado em ${APP_DIR}; pulando git pull"
    return
  fi

  log "Atualizando codigo via git"
  git -C "${APP_DIR}" config --global --add safe.directory "${APP_DIR}" >/dev/null 2>&1 || true
  git -C "${APP_DIR}" restore package-lock.json frontend/package-lock.json >/dev/null 2>&1 || true
  git -C "${APP_DIR}" pull --ff-only origin main
}

install_node_dependencies() {
  log "Instalando dependencias do backend"
  cd "${APP_DIR}"
  npm install --include=dev

  log "Instalando dependencias do frontend"
  cd "${APP_DIR}/frontend"
  npm install --include=dev
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

disable_conflicting_nginx_sites_for_domain() {
  local target_domain="$1"
  local file

  [[ -n "${target_domain}" ]] || return

  shopt -s nullglob
  for file in /etc/nginx/sites-enabled/*; do
    [[ "${file}" == "/etc/nginx/sites-enabled/produtos.conf" ]] && continue
    if grep -Eq "server_name[[:space:]].*(^|[[:space:]])${target_domain}([[:space:];]|$)" "${file}"; then
      log "Desabilitando site Nginx conflitante ${file} para ${target_domain}"
      rm -f "${file}"
    fi
  done
  shopt -u nullglob
}

install_nginx_config() {
  local nginx_file="/etc/nginx/sites-available/produtos.conf"
  local nginx_template="${APP_DIR}/deploy/ubuntu/templates/nginx-produtos.conf.template"
  local cert_fullchain="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  local cert_privkey="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

  mkdir -p /var/www/certbot

  if [[ -f "${cert_fullchain}" && -f "${cert_privkey}" ]]; then
    nginx_template="${APP_DIR}/deploy/ubuntu/templates/nginx-produtos-ssl.conf.template"
  fi

  render_template \
    "${nginx_template}" \
    "${nginx_file}" \
    DOMAIN "${DOMAIN}" \
    APP_PORT "${APP_PORT}" \
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
  local dns_ips

  public_ip="$(curl -fsSL https://api.ipify.org)"
  dns_ips="$(dig +short A "${DOMAIN}")"

  [[ -n "${dns_ips}" ]] || fail "O dominio ${DOMAIN} ainda nao resolve para nenhum IP."
  grep -Fxq "${public_ip}" <<<"${dns_ips}" || \
    fail "O dominio ${DOMAIN} nao aponta para esta VPS (${public_ip}). Ajuste o DNS antes do SSL."
}

install_ssl() {
  if [[ "${SKIP_CERTBOT}" == "true" ]]; then
    log "SSL pulado por --skip-certbot"
    return
  fi

  log "Emitindo ou renovando certificado SSL para ${DOMAIN}"
  certbot --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    -m "${EMAIL}" \
    -d "${DOMAIN}"

  install_nginx_config
}

fix_permissions() {
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
}

print_summary() {
  log "Operacao concluida"
  if [[ -n "${DOMAIN}" ]]; then
    log "Painel admin: https://${DOMAIN}/"
    log "API publica: https://${DOMAIN}/api/v1/products"
  fi
  log "Arquivo de ambiente: ${ENV_FILE}"
}

run_install_action() {
  ensure_base_packages
  ensure_node_22
  ensure_services_running
  ensure_app_user
  ensure_env_files
  write_frontend_env
  load_runtime_defaults_from_env
  ensure_install_inputs
  ensure_required_env_for_install
  ensure_postgres_db
  install_node_dependencies
  build_application
  run_migrations
  fix_permissions
  ensure_backend_port_available
  install_systemd_service
  disable_conflicting_nginx_sites_for_domain "${DOMAIN}"
  install_nginx_config
  ensure_dns_points_to_server
  install_ssl
  print_summary
}

run_update_action() {
  ensure_base_packages
  ensure_node_22
  ensure_services_running
  ensure_app_user
  ensure_env_files
  write_frontend_env
  load_runtime_defaults_from_env
  prepare_existing_env_for_runtime
  update_source_code
  install_node_dependencies
  build_application
  run_migrations
  fix_permissions
  ensure_backend_port_available
  install_systemd_service

  if [[ -n "${DOMAIN}" ]]; then
    disable_conflicting_nginx_sites_for_domain "${DOMAIN}"
    install_nginx_config
  fi

  print_summary
}

run_change_domain_action() {
  ensure_base_packages
  ensure_node_22
  ensure_services_running
  ensure_app_user
  ensure_env_files
  write_frontend_env
  load_runtime_defaults_from_env
  prepare_existing_env_for_runtime

  local previous_domain=""
  if [[ -f "${ENV_FILE}" ]]; then
    previous_domain="$(extract_domain_from_url "$(read_env_value "${ENV_FILE}" "PUBLIC_BASE_URL")")"
  fi

  ensure_change_domain_inputs
  update_public_base_url
  disable_conflicting_nginx_sites_for_domain "${previous_domain}"
  disable_conflicting_nginx_sites_for_domain "${DOMAIN}"
  install_nginx_config
  ensure_dns_points_to_server
  install_ssl
  install_systemd_service
  print_summary
}

main() {
  parse_args "$@"
  refresh_paths
  choose_action_interactively
  require_root
  ensure_ubuntu_2404

  case "${ACTION}" in
    install)
      run_install_action
      ;;
    update)
      run_update_action
      ;;
    change-domain)
      run_change_domain_action
      ;;
    *)
      fail "Acao invalida: ${ACTION}"
      ;;
  esac
}

main "$@"

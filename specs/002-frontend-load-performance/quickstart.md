# Quickstart: Frontend Load Performance Upgrade

## 1. Baseline local

No frontend:

```bash
cd C:\Users\goohf\Desktop\parceiros\frontend
npm install
npm run build
```

Registre:
- tamanho do chunk inicial
- tamanho gzip do JavaScript principal

## 2. Validar waterfall por rota

Suba o frontend em dev e abra o DevTools Network:

```bash
cd C:\Users\goohf\Desktop\parceiros\frontend
npm run dev
```

Fluxos a medir:
- dashboard inicial
- abrir empresa na aba `inventory`
- trocar para `keys`
- trocar para `costs`
- abrir `/docs/api-estoque`

Checklist:
- dashboard nao deve puxar docs nem custos
- aba `inventory` nao deve puxar chaves sem necessidade
- aba `keys` nao deve puxar produtos sem necessidade

## 3. Validar responsividade da listagem

Na empresa com catalogo maior:
- abrir a aba de inventario
- digitar rapidamente na busca
- trocar entre sessoes
- abrir e fechar cards repetidamente

Esperado:
- sem congelamentos perceptiveis
- busca e troca de sessao em ate 100 ms

## 4. Metas de aceite

- JS inicial <= 65 kB gzip
- dashboard navegavel <= 1.2 s
- primeira secao do inventario <= 1.5 s
- requests por rota coerentes com a aba aberta

## 5. Sequencia recomendada de implementacao

1. Aplicar code splitting por rota
2. Isolar fetches por aba
3. Quebrar `CompanyDetailPage` em subcomponentes memoizados
4. Medir novamente bundle e waterfall

function CodeBlock(props: { title: string; code: string }) {
  const { title, code } = props;

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{title}</p>
      </div>
      <pre className="overflow-x-auto px-5 py-5 text-sm leading-7 text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SectionTitle(props: { eyebrow: string; title: string; description: string }) {
  const { eyebrow, title, description } = props;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
    </div>
  );
}

export function PublicInventoryApiDocsPage() {
  const baseUrl =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://produtos.straviinsky.online";

  const getInventoryCurl = [
    `curl -X GET "${baseUrl}/api/v1/my-inventory" \\`,
    '  -H "Authorization: Bearer SUA_API_KEY"'
  ].join("\n");

  const getInventoryResponse = [
    "{",
    '  "data": [',
    "    {",
    '      "productId": "394c7b07-cfbd-4c12-be7d-4ad1394e8ad6",',
    '      "sku": "XCC1054223178/01",',
    '      "name": "Anel em prata 925 estilo meia alianca...",',
    '      "masterStock": 15,',
    '      "customStockQuantity": null,',
    '      "effectiveStockQuantity": 10,',
    '      "updatedAt": "2026-03-26T15:10:00.000Z",',
    '      "variants": [',
    "        {",
    '          "variantId": "5f5d44db-5af9-49d4-9d7b-5658ed9d93cc",',
    '          "productId": "394c7b07-cfbd-4c12-be7d-4ad1394e8ad6",',
    '          "sku": "XCC1054223178/01-ARO-10",',
    '          "individualWeight": 1.47,',
    '          "masterStock": 2,',
    '          "customStockQuantity": 4,',
    '          "effectiveStockQuantity": 4,',
    '          "updatedAt": "2026-03-26T15:10:00.000Z"',
    "        }",
    "      ]",
    "    }",
    "  ],",
    '  "meta": {',
    '    "count": 1,',
    '    "companyId": "efb5cbb2-6fd2-4f8b-a54d-9139a7301db6"',
    "  }",
    "}"
  ].join("\n");

  const postInventoryInitialCurl = [
    `curl -X POST "${baseUrl}/api/v1/my-inventory" \\`,
    '  -H "Authorization: Bearer SUA_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    '    "items": [',
    "      {",
    '        "sku": "XCC1054223178/01",',
    '        "custom_stock_quantity": 100',
    "      },",
    "      {",
    '        "sku": "XCC1454223302/01",',
    '        "custom_stock_quantity": 12',
    "      }",
    "    ]",
    "  }'"
  ].join("\n");

  const postInventoryVariantsCurl = [
    `curl -X POST "${baseUrl}/api/v1/my-inventory" \\`,
    '  -H "Authorization: Bearer SUA_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    '    "items": [',
    "      {",
    '        "sku": "XCC1054223178/01",',
    '        "variants": [',
    "          {",
    '            "sku": "XCC1054223178/01-ARO-10",',
    '            "custom_stock_quantity": 4',
    "          },",
    "          {",
    '            "variant_id": "5f5d44db-5af9-49d4-9d7b-5658ed9d93cc",',
    '            "custom_stock_quantity": 6',
    "          }",
    "        ]",
    "      }",
    "    ]",
    "  }'"
  ].join("\n");

  const postInventoryResponse = [
    "{",
    '  "data": [',
    "    {",
    '      "productId": "394c7b07-cfbd-4c12-be7d-4ad1394e8ad6",',
    '      "sku": "XCC1054223178/01",',
    '      "name": "Anel em prata 925 estilo meia alianca...",',
    '      "masterStock": 15,',
    '      "customStockQuantity": 10,',
    '      "effectiveStockQuantity": 10,',
    '      "updatedAt": "2026-03-26T15:10:00.000Z",',
    '      "variants": [',
    "        {",
    '          "variantId": "5f5d44db-5af9-49d4-9d7b-5658ed9d93cc",',
    '          "sku": "XCC1054223178/01-ARO-10",',
    '          "masterStock": 2,',
    '          "customStockQuantity": 4,',
    '          "effectiveStockQuantity": 4',
    "        },",
    "        {",
    '          "variantId": "cc5358b8-44db-4b7f-bd2c-6c5e8c4cf5b2",',
    '          "sku": "XCC1054223178/01-ARO-11",',
    '          "masterStock": 3,',
    '          "customStockQuantity": 6,',
    '          "effectiveStockQuantity": 6',
    "        }",
    "      ]",
    "    }",
    "  ],",
    '  "errors": [],',
    '  "meta": {',
    '    "companyId": "efb5cbb2-6fd2-4f8b-a54d-9139a7301db6",',
    '    "receivedCount": 1,',
    '    "updatedCount": 1,',
    '    "errorCount": 0',
    "  }",
    "}"
  ].join("\n");

  const postInventoryErrorResponse = [
    "{",
    '  "data": [],',
    '  "errors": [',
    "    {",
    '      "index": 0,',
    '      "productId": null,',
    '      "sku": "SKU-INEXISTENTE",',
    '      "code": null,',
    '      "numeroSerie": null,',
    '      "message": "Produto nao encontrado para o product_id ou sku/codigo informado"',
    "    }",
    "  ],",
    '  "meta": {',
    '    "companyId": "efb5cbb2-6fd2-4f8b-a54d-9139a7301db6",',
    '    "receivedCount": 1,',
    '    "updatedCount": 0,',
    '    "errorCount": 1',
    "  }",
    "}"
  ].join("\n");

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.16),_transparent_24%)]" />
      <div className="mx-auto flex min-h-screen max-w-[1320px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Documentacao Publica
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
              </div>
              <h1 className="mt-4 font-display text-4xl tracking-tight text-slate-950 sm:text-5xl">
                API de estoque para parceiros
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                Esta pagina explica como consultar o estoque atual e como enviar a
                quantidade usada pela loja parceira usando as rotas publicas
                <code className="mx-1 rounded bg-slate-100 px-2 py-1 text-xs">GET /api/v1/my-inventory</code>
                e
                <code className="mx-1 rounded bg-slate-100 px-2 py-1 text-xs">POST /api/v1/my-inventory</code>.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                Abrir painel
              </a>
              <a
                href={`${baseUrl}/api/v1/my-inventory`}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Endpoint base
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-[1.7rem] border border-slate-200 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Auth</p>
            <p className="mt-3 font-display text-3xl tracking-tight text-slate-950">Bearer token</p>
            <p className="mt-2 text-sm text-slate-600">
              Toda chamada usa a API key emitida para a empresa em
              <code className="ml-1 rounded bg-slate-100 px-2 py-1 text-xs">Authorization: Bearer ...</code>
            </p>
          </article>
          <article className="rounded-[1.7rem] border border-emerald-200 bg-emerald-50/85 p-5 shadow-[0_18px_50px_rgba(16,185,129,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Leitura</p>
            <p className="mt-3 font-display text-3xl tracking-tight text-emerald-950">GET</p>
            <p className="mt-2 text-sm text-emerald-900">
              Lista o estoque efetivo da empresa, incluindo variantes quando existirem.
            </p>
          </article>
          <article className="rounded-[1.7rem] border border-amber-200 bg-amber-50/90 p-5 shadow-[0_18px_50px_rgba(245,158,11,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Escrita</p>
            <p className="mt-3 font-display text-3xl tracking-tight text-amber-950">POST</p>
            <p className="mt-2 text-sm text-amber-900">
              Aceita carga inicial em lote, atualizacao individual por produto e envio de estoque por variante.
            </p>
          </article>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <SectionTitle
            eyebrow="Como autenticar"
            title="Use a API key da propria empresa"
            description="A documentacao e publica, mas os dados continuam protegidos. Cada empresa deve usar a chave emitida no painel para consultar e sincronizar apenas o proprio estoque."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">Header obrigatorio</p>
              <p className="mt-3 rounded-xl bg-white px-4 py-3 font-mono text-sm text-slate-800">
                Authorization: Bearer SUA_API_KEY
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">Dominio publico</p>
              <p className="mt-3 rounded-xl bg-white px-4 py-3 font-mono text-sm text-slate-800">
                {baseUrl}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <SectionTitle
            eyebrow="GET /api/v1/my-inventory"
            title="Consultar o estoque atual da empresa"
            description="Use esta rota para ler o estoque efetivo que a plataforma esta considerando para a empresa autenticada. Quando houver variantes sincronizadas, o total do produto ja vem refletindo a soma dessas variantes."
          />

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <CodeBlock title="Exemplo de chamada" code={getInventoryCurl} />
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">O que esta rota devolve</p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                <li>
                  <strong className="text-slate-900">productId, sku, name</strong>: identificam o produto mestre.
                </li>
                <li>
                  <strong className="text-slate-900">masterStock</strong>: estoque base vindo do catalogo mestre.
                </li>
                <li>
                  <strong className="text-slate-900">customStockQuantity</strong>: valor salvo pela empresa quando existir.
                </li>
                <li>
                  <strong className="text-slate-900">effectiveStockQuantity</strong>: estoque efetivo que a aplicacao deve usar.
                </li>
                <li>
                  <strong className="text-slate-900">variants</strong>: lista das variantes com estoque mestre e estoque customizado da empresa.
                </li>
              </ul>
            </div>
          </div>

          <CodeBlock title="Resposta de exemplo" code={getInventoryResponse} />
        </section>

        <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <SectionTitle
            eyebrow="POST /api/v1/my-inventory"
            title="Enviar estoque da loja parceira"
            description="Use esta rota tanto na primeira conexao quanto nas atualizacoes seguintes. O mesmo endpoint aceita envio por produto, por variante ou em lote misto."
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">Carga inicial</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Envie varios itens no array <code className="rounded bg-white px-2 py-1 text-xs">items</code> para registrar o estoque atual da loja de uma vez.
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">Atualizacao individual</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Envie apenas um item quando precisar corrigir o estoque de um produto especifico.
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">Variantes</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Quando houver grade, envie o array <code className="rounded bg-white px-2 py-1 text-xs">variants</code> e o total do produto passa a refletir a soma dessas variantes.
              </p>
            </div>
          </div>

          <CodeBlock title="Carga inicial por produto" code={postInventoryInitialCurl} />
          <CodeBlock title="Envio por variantes" code={postInventoryVariantsCurl} />
          <CodeBlock title="Resposta de sucesso" code={postInventoryResponse} />
          <CodeBlock title="Resposta com erros por item" code={postInventoryErrorResponse} />
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <SectionTitle
            eyebrow="Regras praticas"
            title="Como decidir entre produto e variante"
            description="Escolha o formato de envio conforme o nivel de controle que a empresa possui no proprio estoque."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.6rem] border border-cyan-200 bg-cyan-50 p-5">
              <p className="text-sm font-semibold text-cyan-950">Envie no nivel do produto quando</p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-cyan-900">
                <li>A loja controla apenas um numero total por SKU principal.</li>
                <li>A primeira integracao precisa subir o saldo geral rapidamente.</li>
                <li>Nao existe separacao de estoque por tamanho, cor ou variante.</li>
              </ul>
            </div>
            <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-950">Envie no nivel da variante quando</p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-amber-900">
                <li>A loja controla estoque por tamanho, aro, cor ou outra grade.</li>
                <li>Voce precisa saber o saldo exato de cada variante no parceiro.</li>
                <li>O produto pai deve refletir a soma das variantes enviadas.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

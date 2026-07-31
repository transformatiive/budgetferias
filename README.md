# Orçamento Férias — Suíça 2026

App temporária para acompanhar as despesas da viagem (18 dias, 4 adultos, Jul–Ago 2026)
comparando o gasto real com o orçamento previsto. Uso pessoal, sem autenticação.

## Correr localmente

```bash
npm install
npm start          # http://localhost:3000
```

Sem `DATABASE_URL` usa SQLite local (`budgetferias.sqlite`). Com `DATABASE_URL`
definido usa Postgres. Em ambos os casos a tabela é criada automaticamente e o
seed inicial é carregado quando a base de dados está vazia.

## Configuração

Tudo o que muda com a viagem está em `src/config.js`:

- `TRIP_START` / `TOTAL_DAYS`
- `CATEGORIES` — categorias fixas, orçamento previsto e modo de *pacing*
- `BOOKINGS` — reservas de alojamento confirmadas (adicionar Zaragoza, Chamonix, …)
- `SEED_EXPENSES` — despesas pré-carregadas no primeiro arranque

### Pacing

Como se calcula "quanto deveria já ter sido gasto até hoje":

- `daily` — `(planned / TOTAL_DAYS) × dias decorridos`
- `booked` — soma das reservas cujo `paidBy` já passou (usado no Alojamento, que é
  pago em blocos antecipados)

## API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/expenses` | cria despesa — `{ description, category, amount, expense_date, note? }` |
| `GET` | `/api/expenses` | lista todas (mais recente primeiro) |
| `DELETE` | `/api/expenses/:id` | apaga uma |
| `GET` | `/api/summary` | por categoria: `planned`, `spent`, `expectedSoFar`, `diffSoFar`, `pacingLabel`, `note` + totais |
| `GET` | `/api/budget` | orçamentos previstos em vigor, por categoria |
| `PUT` | `/api/budget/:category` | atualiza orçamento — `{ planned?, note? }` |
| `GET` | `/api/config` | categorias e reservas configuradas |
| `GET` | `/health` | estado do serviço |

`category` tem de ser uma de: `refeicoes`, `alojamento`, `atividades`, `transporte`, `outros`.
`expense_date` no formato `YYYY-MM-DD`.

Exemplo:

```bash
curl -X POST https://<url>/api/expenses \
  -H 'Content-Type: application/json' \
  -d '{"description":"Jantar em Zermatt","category":"refeicoes","amount":45,"expense_date":"2026-08-09"}'
```

### Alterar orçamentos sem mexer no código

Os valores de `CATEGORIES` em `src/config.js` são apenas o **valor por omissão**.
Qualquer alteração feita por `PUT /api/budget/:category` fica guardada na base de
dados e prevalece sobre o config — sobrevive a redeploys.

```bash
# só o valor previsto
curl -X PUT https://<url>/api/budget/atividades \
  -H 'Content-Type: application/json' -d '{"planned":2100}'

# só a nota (o planned mantém-se)
curl -X PUT https://<url>/api/budget/alojamento \
  -H 'Content-Type: application/json' -d '{"note":"Falta Zaragoza e Chamonix."}'
```

Campos omitidos ficam inalterados; `"note": null` limpa a nota e repõe a do config.

## Deploy

Railway (Nixpacks, `npm start`). Ligar um Postgres ao serviço e expor
`DATABASE_URL`; o `PORT` é fornecido pela plataforma.

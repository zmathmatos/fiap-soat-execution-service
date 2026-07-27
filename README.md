# FIAP SOAT Tech Challenge - Execution Service

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=zmathmatos_fiap-soat-execution-service&metric=alert_status)](https://sonarcloud.io/summary/overall?id=zmathmatos_fiap-soat-execution-service)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=zmathmatos_fiap-soat-execution-service&metric=coverage)](https://sonarcloud.io/component_measures?id=zmathmatos_fiap-soat-execution-service&metric=coverage)

Microsserviço de **Execução e Produção** da oficina mecânica (Fase 4).

## Responsabilidades

- Gerenciar duas filas **FIFO**: **Fila de Diagnóstico** e **Fila de Execução**;
- Registrar o diagnóstico (peças e serviços necessários) e publicar o evento `diagnostic.finished`;
- Atualizar progresso durante diagnóstico e reparos;
- Comunicar finalização — eventos `execution.finished` / `execution.failed`.

## Arquitetura

Este serviço faz parte de uma arquitetura de microsserviços coordenada via **Saga Pattern coreografada**: não existe orquestrador central. Cada serviço é dono do seu pedaço do fluxo, publica eventos de domínio no RabbitMQ e reage aos eventos dos outros para levar a saga adiante.

| Repositório | Conteúdo |
|---|---|
| [fiap-soat-os-service](https://github.com/zmathmatos/fiap-soat-os-service) | Ordens de serviço e cadastros (usuários/veículos/peças/serviços) |
| [fiap-soat-billing-service](https://github.com/zmathmatos/fiap-soat-billing-service) | Orçamento e pagamento (Mercado Pago) |
| **fiap-soat-execution-service** | ← Este repo — Filas de diagnóstico e execução, reparos |
| [fiap-soat-tech-challenge-infra-db](https://github.com/zmathmatos/fiap-soat-tech-challenge-infra-db) | Infraestrutura (EKS, RDS, RabbitMQ, MongoDB) via Terraform |

Regra de propriedade dos eventos: **quem executa a etapa publica o evento dela.** Por isso o `diagnostic.finished` é publicado por este serviço (é ele que possui a fila de diagnóstico e recebe o registro do mecânico), e não pelo os-service.

O código segue **Clean Architecture**:

```
src/
  domain/          # Entidade ExecutionOrder (state machine), VOs, interfaces de repositório, erros
  application/     # Use cases, DTOs, porta IEventPublisher
  infrastructure/  # TypeORM (Postgres schema "execution"), RabbitMQ (consumers/publisher), config
  interface/       # Controllers e rotas Express, error handler
```

## Ciclo de vida de uma ordem

```
order.received ──▶ IN_DIAGNOSIS_QUEUE ──PATCH /diagnosis──▶ AWAITING_PAYMENT
    (os-service)      (fila 1, FIFO)     (só a cabeça da fila)     │
                                         publica diagnostic.finished
                                                                  │
                             payment.failed / quotation.rejected   │ payment.approved
                                          ▼                        ▼
                                     CANCELLED        IN_EXECUTION_QUEUE (fila 2, FIFO)
                                                                  │ PATCH /start (só a cabeça da fila)
                                                                  ▼
                                                             IN_EXECUTION
                                                            /            \
                                               PATCH /finish              PATCH /fail
                                                      ▼                        ▼
                                                  FINISHED                  FAILED
                                            (execution.finished)      (execution.failed)
```

- **FIFO garantido nas duas filas**: cada entrada em fila recebe um `queue_seq` de uma sequence do Postgres; consultas ordenam por ele e apenas a **cabeça** da fila pode avançar — tanto para registrar diagnóstico quanto para iniciar reparo (`409` caso contrário).
- **Compensação da Saga**: `payment.failed` e `quotation.rejected` cancelam a ordem; o cancelamento é aceito em qualquer etapa anterior ao início do reparo (fila de diagnóstico, aguardando pagamento ou fila de execução).
- **Consumers idempotentes**: eventos deduplicados por `messageId` (tabela `processed_events`).

## Contratos de eventos (RabbitMQ)

Cada exchange pertence ao serviço que publica nela.

### Consumidos

| Exchange (topic) | Routing key | Publicado por | Payload |
|---|---|---|---|
| `service-order-events` | `order.received` | os-service | `{ serviceOrderId, serviceOrderNumber }` |
| `payment-events` | `payment.approved` | billing-service | `{ serviceOrderId }` |
| `payment-events` | `payment.failed` | billing-service | `{ serviceOrderId }` |
| `payment-events` | `quotation.rejected` | billing-service | `{ serviceOrderId }` |

Filas duráveis: `execution-service.service-order-events`, `execution-service.payment-events`.

### Publicados

| Exchange (topic) | Routing key | Consumido por | Payload |
|---|---|---|---|
| `execution-events` | `diagnostic.finished` | os-service | `{ serviceOrderId, parts: [{id, name, quantity, price}], services: [{id, name, price}] }` |
| `execution-events` | `execution.finished` | os-service | `{ serviceOrderId, finishedAt }` |
| `execution-events` | `execution.failed` | os-service | `{ serviceOrderId, reason, failedAt }` |

**Política de erros dos consumers**: falhas permanentes (payload inválido, ordem desconhecida, transição ilegal) são logadas e descartadas (`nack` sem requeue); falhas transitórias (banco indisponível) voltam para a fila.

## API REST

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/queues/diagnosis` | Fila de diagnóstico em ordem FIFO |
| `GET` | `/api/queues/execution` | Fila de execução em ordem FIFO |
| `GET` | `/api/executions/:serviceOrderId` | Detalhe da ordem (status, diagnóstico, timestamps) |
| `PATCH` | `/api/executions/:serviceOrderId/diagnosis` | Body `{ "parts": [...], "services": [...] }` — só a cabeça da fila de diagnóstico (`409` caso contrário) → publica `diagnostic.finished` |
| `PATCH` | `/api/executions/:serviceOrderId/start` | Inicia o reparo — só a cabeça da fila de execução (`409` caso contrário) |
| `PATCH` | `/api/executions/:serviceOrderId/finish` | Conclui o reparo → publica `execution.finished` |
| `PATCH` | `/api/executions/:serviceOrderId/fail` | Body `{ "reason": "..." }` → publica `execution.failed` |
| `GET` | `/health` | Liveness (status do banco e do RabbitMQ) |

Erros: `404` ordem desconhecida, `409` transição ilegal / fora da ordem FIFO, `422` payload inválido.

Collection do Postman: [`postman_collection.json`](postman_collection.json).

## Banco de dados

**PostgreSQL** — schema `execution` (isolamento lógico; ver decisão de arquitetura no [repo de infra](https://github.com/zmathmatos/fiap-soat-tech-challenge-infra-db)). Nenhum outro serviço acessa este schema. Migrations TypeORM rodam automaticamente no boot.

| Tabela | Conteúdo |
|---|---|
| `execution_orders` | Espelho local da OS: status, diagnóstico (jsonb), `queue_seq` (posição FIFO), timestamps |
| `processed_events` | Dedupe de eventos consumidos (`message_id`) |

## Rodando localmente

O broker RabbitMQ é **único para todos os serviços** e sobe junto com o os-service (`docker-compose.dev.yml`, container `fiap-rabbitmq-dev`). Este compose sobe apenas o app e o Postgres dele, conectando-se ao broker pela rede externa `fiap-net`.

```bash
# uma única vez, se a rede ainda não existir
docker network create fiap-net

# broker + os-service (no repo do os-service)
docker compose -f docker-compose.dev.yml up

# aqui: app + Postgres (porta 5434 no host)
docker compose up --build

# desenvolvimento com hot reload
npm install
npm run dev
```

### Simulando o fluxo completo

O script `scripts/publish-event.ts` simula os serviços vizinhos (os-service e billing-service). O `diagnostic.finished` **não** está no script — quem publica é este serviço, via endpoint REST.

```bash
SO_ID=$(node -e "console.log(require('crypto').randomUUID())")

npm run publish-event -- order.received $SO_ID 1        # entra na fila de diagnóstico

curl -X PATCH http://localhost:3002/api/executions/$SO_ID/diagnosis \
  -H "Content-Type: application/json" \
  -d '{"parts":[{"id":"p1","name":"Pastilha de freio","quantity":2,"price":150}],"services":[{"id":"s1","name":"Troca de pastilhas","price":300}]}'
                                                        # publica diagnostic.finished

npm run publish-event -- payment.approved $SO_ID        # entra na fila de execução

curl http://localhost:3002/api/queues/execution         # ver a fila
curl -X PATCH http://localhost:3002/api/executions/$SO_ID/start
curl -X PATCH http://localhost:3002/api/executions/$SO_ID/finish   # publica execution.finished
```

## Testes

```bash
npm run test:unit       # unitários (domínio, use cases, consumers, API)
npm run test:int        # integração (requer Postgres do compose)
npm run test:bdd        # BDD Cucumber — fluxo completo em Gherkin (features/)
npm run test:coverage   # cobertura (mínimo 80% enforced)
npm run lint            # ESLint
```

## Observabilidade

O serviço roda com o agente APM do New Relic carregado antes da aplicação (`node -r newrelic dist/server.js`). A configuração fica em `newrelic.js` e é controlada por variáveis de ambiente, então o agente só sobe quando `NEW_RELIC_ENABLED=true` — em desenvolvimento e nos testes ele fica desligado.

| Variável | Origem | Descrição |
|---|---|---|
| `NEW_RELIC_ENABLED` | ConfigMap (CD) | Liga o agente. `true` em produção |
| `NEW_RELIC_APP_NAME` | Variable do repo | Nome da aplicação no New Relic. Padrão: `fiap-execution-service` |
| `NEW_RELIC_LICENSE_KEY` | Secret do repo | Chave de licença da conta |

O **distributed tracing** está habilitado nos três microsserviços, o que permite acompanhar uma ordem de serviço atravessando `os-service → execution-service → billing-service` em um único trace, mesmo com os saltos assíncronos via RabbitMQ. O forwarding de logs também está ligado, então os logs do Pino aparecem correlacionados com as transações.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint → testes unitários → integração (Postgres em service container) → BDD → cobertura + SonarCloud → build.
- **CD** (`.github/workflows/cd.yml`): push em `main` → build da imagem → ECR → deploy no EKS (`k8s/deployment.yaml`).

## Stack

Node.js 22, TypeScript 5, Express 5, TypeORM + PostgreSQL, RabbitMQ (amqplib), Pino, New Relic APM, Jest, Cucumber, Docker, Kubernetes (EKS), GitHub Actions, SonarCloud.

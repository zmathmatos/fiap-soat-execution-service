# FIAP SOAT Tech Challenge - Execution Service

Microsserviço de **Execução e Produção** da oficina mecânica (Fase 4).

## Responsabilidades

- Gerenciar duas filas **FIFO**: **Fila de Diagnóstico** e **Fila de Execução**;
- Registrar diagnóstico (peças e serviços necessários) — evento `diagnostic.finished`;
- Atualizar progresso durante diagnóstico e reparos;
- Comunicar finalização ao OS Service — eventos `execution.finished` / `execution.failed`.

## Arquitetura

Este serviço faz parte de uma arquitetura de microsserviços coordenada via **Saga Pattern orquestrada**, onde o [OS Service](https://github.com/zmathmatos/fiap-soat-os-service) atua como orquestrador.

| Repositório | Conteúdo |
|---|---|
| [fiap-soat-os-service](https://github.com/zmathmatos/fiap-soat-os-service) | Ordens de serviço, cadastro (usuários/veículos), orquestração da Saga |
| [fiap-soat-billing-service](https://github.com/zmathmatos/fiap-soat-billing-service) | Orçamento e pagamento (Mercado Pago) |
| **fiap-soat-execution-service** | ← Este repo — Fila de execução, diagnóstico e reparos |
| [fiap-soat-tech-challenge-infra-db](https://github.com/zmathmatos/fiap-soat-tech-challenge-infra-db) | Infraestrutura (EKS, RDS, RabbitMQ, MongoDB) via Terraform |

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
order.received ──▶ IN_DIAGNOSIS_QUEUE ──diagnostic.finished──▶ AWAITING_PAYMENT
                        (fila 1, FIFO)                              │
                                                     payment.failed │ payment.approved
                                                          ▼         ▼
                                                     CANCELLED   IN_EXECUTION_QUEUE (fila 2, FIFO)
                                                                    │ PATCH /start (só a cabeça da fila)
                                                                    ▼
                                                               IN_EXECUTION
                                                              /            \
                                                 PATCH /finish              PATCH /fail
                                                        ▼                        ▼
                                                    FINISHED                  FAILED
                                              (execution.finished)      (execution.failed)
```

- **FIFO garantido**: cada entrada em fila recebe um `queue_seq` de uma sequence do Postgres; consultas ordenam por ele e apenas a **cabeça** da fila de execução pode iniciar reparo (`409` caso contrário).
- **Compensação da Saga**: `payment.failed` cancela a ordem antes de entrar na fila de execução.
- **Consumers idempotentes**: eventos deduplicados por `messageId` (tabela `processed_events`).

## Contratos de eventos (RabbitMQ)

### Consumidos

| Exchange (topic) | Routing key | Publicado por | Payload |
|---|---|---|---|
| `service-order-events` | `order.received` | os-service | `{ serviceOrderId, serviceOrderNumber }` |
| `service-order-events` | `diagnostic.finished` | os-service | `{ serviceOrderId, parts: [{id, name, quantity, price}], services: [{id, name, price}] }` |
| `payment-events` | `payment.approved` | billing-service | `{ serviceOrderId }` |
| `payment-events` | `payment.failed` | billing-service | `{ serviceOrderId }` |

Filas duráveis: `execution-service.service-order-events`, `execution-service.payment-events`.

> **Nota:** a publicação de `order.received` e `diagnostic.finished` pelo os-service, e o consumo de `execution-events` por ele, são implementados no repositório do os-service.

### Publicados

| Exchange (topic) | Routing key | Consumido por | Payload |
|---|---|---|---|
| `execution-events` | `execution.finished` | os-service | `{ serviceOrderId, finishedAt }` |
| `execution-events` | `execution.failed` | os-service | `{ serviceOrderId, reason, failedAt }` |

**Política de erros dos consumers**: falhas permanentes (payload inválido, ordem desconhecida, transição ilegal) são logadas e descartadas (`nack` sem requeue); falhas transitórias (banco indisponível) voltam para a fila.

## API REST

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/queues/diagnosis` | Fila de diagnóstico em ordem FIFO |
| `GET` | `/api/queues/execution` | Fila de execução em ordem FIFO |
| `GET` | `/api/executions/:serviceOrderId` | Detalhe da ordem (status, diagnóstico, timestamps) |
| `PATCH` | `/api/executions/:serviceOrderId/start` | Inicia o reparo — só a cabeça da fila (`409` caso contrário) |
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

```bash
# Stack completa: app + Postgres + RabbitMQ (management UI em http://localhost:15672, guest/guest)
docker compose up --build

# Desenvolvimento com hot reload (requer Postgres/RabbitMQ do compose)
npm install
npm run dev
```

### Simulando o fluxo completo

O script `scripts/publish-event.ts` simula os serviços vizinhos publicando eventos:

```bash
SO_ID=$(node -e "console.log(require('crypto').randomUUID())")

npm run publish-event -- order.received $SO_ID 1        # entra na fila de diagnóstico
npm run publish-event -- diagnostic.finished $SO_ID     # diagnóstico registrado
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

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint → testes unitários → integração (Postgres em service container) → BDD → cobertura + SonarCloud → build.
- **CD** (`.github/workflows/cd.yml`): push em `master` → build da imagem → ECR → deploy no EKS (`k8s/deployment.yaml`).

## Stack

Node.js 22, TypeScript 5, Express 5, TypeORM + PostgreSQL, RabbitMQ (amqplib), Pino, Jest, Cucumber, Docker, Kubernetes (EKS), GitHub Actions, SonarCloud.

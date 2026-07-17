# FIAP SOAT Tech Challenge - Execution Service

Microsserviço de **Execução e Produção** da oficina mecânica (Fase 4).

## Responsabilidades

- Gerenciar a fila de execução das ordens de serviço;
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
| [fiap-soat-tech-challenge-infra-db](https://github.com/zmathmatos/fiap-soat-tech-challenge-infra-db) | Infraestrutura dos bancos de dados via Terraform |

## Banco de dados

**PostgreSQL** (SQL) — instância própria e exclusiva deste serviço. Ele vai ter seu próprio schema (para separação lógica do bancos) chamado `execution`. Nenhum outro serviço acessa este banco diretamente.

> OBSERVAÇÃO: Devido à questão de limitação de créditos do AWS Academy, teremos o banco de dados provisionado pelo repositório `fiap-soat-tech-challenge-infra-db` e a isolamento dos bancos dos microsserviços será lógico. Mas estamos cientes de que em uma aplicação real cada serviço possui seu próprio banco.

## Comunicação

- **Assíncrona**: comandos recebidos e eventos publicados via mensageria (RabbitMQ);
- **Síncrona**: API REST para consulta da fila de execução.

## Stack

Node.js, TypeScript, Express — Clean Architecture (domain / application / infrastructure / interface).

## Status

🚧 Em desenvolvimento — migração da funcionalidade de execução (diagnóstico, reparos, conclusão) a partir do monolito da Fase 3.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

`fiap-soat-execution-service` is a Node.js/TypeScript microservice responsible for managing the work order execution queue in an automotive workshop system. It is part of a larger microservices architecture using the **Saga Pattern (orchestrated)**, where `fiap-soat-os-service` acts as orchestrator.

**Core responsibilities:**
- Maintain two FIFO queues: **Diagnosis Queue** and **In Execution Queue** — service orders must be processed in the exact order they were received
- Receive `diagnostic.finished` events via RabbitMQ to register parts and services required for a repair
- Update order status throughout the diagnosis and repair lifecycle
- Notify `fiap-soat-os-service` upon completion via `execution.finished` or `execution.failed` events

**Communication:**
- **Async**: RabbitMQ for event-driven integration with other services
- **Sync**: REST API (Express) for querying execution queue state

## Architecture

The project follows **Clean Architecture** with four layers:

```
src/
  domain/          # Entities, value objects, repository interfaces, domain events
  application/     # Use cases, DTOs, application services
  infrastructure/  # Postgres (TypeORM or Prisma), RabbitMQ clients, HTTP clients
  interface/       # Express routes, controllers, middleware, RabbitMQ consumers
```

Dependencies point inward: `interface` → `application` → `domain`. Infrastructure implements interfaces defined in the domain.

The two queues are the central data structure of the service. They behave as ordered lists (FIFO): new service orders are appended and processed from the front. No reordering is allowed.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express
- **Database**: PostgreSQL (dedicated instance, exclusive to this service)
- **Messaging**: RabbitMQ
- **Infrastructure**: Terraform (AWS provisioning)
- **Deployment**: Kubernetes on AWS; Docker + Docker Compose for local development and image build
- **CI/CD**: GitHub Actions — CI runs tests, CD deploys to AWS
- **Code Quality**: SonarCloud (security, test coverage, static analysis)

## Commands

> These will be defined as the project is scaffolded. Expected conventions:

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Start with hot reload (ts-node-dev or nodemon)
npm run lint           # ESLint
npm run test           # Jest — all tests
npm run test:unit      # Unit tests only
npm run test:int       # Integration tests only
npm run test:coverage  # Coverage report (must stay ≥ 80%)
npm run test -- --testPathPattern=<file>  # Run a single test file
```

Docker:
```bash
docker compose up      # Start service + Postgres locally
docker compose down    # Stop and remove containers
```

## Testing Requirements

- Minimum **80% coverage** enforced (lines, branches, functions)
- **Unit tests** for all use cases, domain entities, and pure business logic — no real DB or HTTP
- **Integration tests** for repository implementations and RabbitMQ consumers where the behavior cannot be adequately covered by mocks
- Tests live alongside source files or in a `test/` mirror structure — follow whichever convention is established at scaffolding time

## Infrastructure

- All AWS resources are provisioned via **Terraform** (directory TBD, likely `infra/terraform/`)
- Kubernetes manifests live in a dedicated infrastructure repository or under `infra/k8s/`
- The service is deployed as a containerized workload on EKS
- The Postgres instance is exclusive to this service (no shared database with other microservices)

## Commit Style

Conventional Commits with optional scope. Examples:
- `feat: add diagnosis queue consumer`
- `fix(cd): configure New Relic agent`
- `chore(deps): upgrade express to v5`

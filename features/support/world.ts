import { setWorldConstructor, World } from "@cucumber/cucumber";
import { InMemoryExecutionOrderRepository } from "../../tests/fakes/InMemoryExecutionOrderRepository";
import { FakeEventPublisher } from "../../tests/fakes/FakeEventPublisher";
import { EnqueueForDiagnosis } from "../../src/application/use-cases/EnqueueForDiagnosis";
import { RegisterDiagnosis } from "../../src/application/use-cases/RegisterDiagnosis";
import { EnqueueForExecution } from "../../src/application/use-cases/EnqueueForExecution";
import { CancelExecution } from "../../src/application/use-cases/CancelExecution";
import { StartExecution } from "../../src/application/use-cases/StartExecution";
import { FinishExecution } from "../../src/application/use-cases/FinishExecution";
import { FailExecution } from "../../src/application/use-cases/FailExecution";
import { GetQueue } from "../../src/application/use-cases/GetQueue";
export class ExecutionWorld extends World {
    readonly repo = new InMemoryExecutionOrderRepository();
    readonly publisher = new FakeEventPublisher();
    readonly enqueueForDiagnosis = new EnqueueForDiagnosis(this.repo);
    readonly registerDiagnosis = new RegisterDiagnosis(this.repo);
    readonly enqueueForExecution = new EnqueueForExecution(this.repo);
    readonly cancelExecution = new CancelExecution(this.repo);
    readonly startExecution = new StartExecution(this.repo);
    readonly finishExecution = new FinishExecution(this.repo, this.publisher);
    readonly failExecution = new FailExecution(this.repo, this.publisher);
    readonly getQueue = new GetQueue(this.repo);
    lastError: Error | null = null;
    private orderNumbers = new Map<string, number>();
    private nextNumber = 1;
    orderNumber(alias: string): number {
        if (!this.orderNumbers.has(alias)) {
            this.orderNumbers.set(alias, this.nextNumber++);
        }
        return this.orderNumbers.get(alias)!;
    }
}
setWorldConstructor(ExecutionWorld);

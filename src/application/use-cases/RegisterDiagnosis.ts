import { ExecutionOrderStatus } from "../../domain/entities/ExecutionOrder";
import { Diagnosis, DiagnosisPart, DiagnosisService } from "../../domain/value-objects/Diagnosis";
import { NotFoundError } from "../../domain/errors/NotFoundError";
import { NotHeadOfQueueError } from "../../domain/errors/NotHeadOfQueueError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
import { IEventPublisher } from "../ports/IEventPublisher";
interface Input {
    serviceOrderId: string;
    parts: DiagnosisPart[];
    services: DiagnosisService[];
}
export class RegisterDiagnosis {
    constructor(private readonly repository: IExecutionOrderRepository, private readonly publisher: IEventPublisher) { }
    async execute({ serviceOrderId, parts, services }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        if (order.status === ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE) {
            const queue = await this.repository.findQueue(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
            const head = queue[0];
            if (!head || head.serviceOrderId !== serviceOrderId) {
                throw new NotHeadOfQueueError(serviceOrderId, "diagnosis");
            }
        }
        order.registerDiagnosis(new Diagnosis(parts, services));
        await this.repository.save(order);
        await this.publisher.publishDiagnosticFinished({ serviceOrderId, parts, services });
    }
}

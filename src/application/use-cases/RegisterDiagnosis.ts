import { Diagnosis, DiagnosisPart, DiagnosisService } from "../../domain/value-objects/Diagnosis";
import { NotFoundError } from "../../domain/errors/NotFoundError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
interface Input {
    serviceOrderId: string;
    parts: DiagnosisPart[];
    services: DiagnosisService[];
}
export class RegisterDiagnosis {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute({ serviceOrderId, parts, services }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        order.registerDiagnosis(new Diagnosis(parts, services));
        await this.repository.save(order);
    }
}

import { NotFoundError } from "../../domain/errors/NotFoundError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
import { ExecutionOrderDTO, toDTO } from "../dtos/ExecutionOrderDTO";
export class GetExecutionOrder {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute(serviceOrderId: string): Promise<ExecutionOrderDTO> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        return toDTO(order);
    }
}

import { NotFoundError } from "../../domain/errors/NotFoundError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
interface Input {
    serviceOrderId: string;
}
export class CancelExecution {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute({ serviceOrderId }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        order.cancel();
        await this.repository.save(order);
    }
}

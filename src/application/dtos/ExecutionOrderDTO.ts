import { ExecutionOrder, ExecutionOrderStatus } from "../../domain/entities/ExecutionOrder";
import { DiagnosisPart, DiagnosisService } from "../../domain/value-objects/Diagnosis";
export interface ExecutionOrderDTO {
    id: string;
    serviceOrderId: string;
    serviceOrderNumber: number;
    status: ExecutionOrderStatus;
    diagnosis: {
        parts: DiagnosisPart[];
        services: DiagnosisService[];
    } | null;
    enqueuedAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
}
export interface QueueItemDTO extends ExecutionOrderDTO {
    position: number;
}
export function toDTO(order: ExecutionOrder): ExecutionOrderDTO {
    return {
        id: order.id,
        serviceOrderId: order.serviceOrderId,
        serviceOrderNumber: order.serviceOrderNumber,
        status: order.status,
        diagnosis: order.diagnosis
            ? { parts: order.diagnosis.parts, services: order.diagnosis.services }
            : null,
        enqueuedAt: order.enqueuedAt?.toISOString() ?? null,
        startedAt: order.startedAt?.toISOString() ?? null,
        finishedAt: order.finishedAt?.toISOString() ?? null,
        failedAt: order.failedAt?.toISOString() ?? null,
        failureReason: order.failureReason
    };
}

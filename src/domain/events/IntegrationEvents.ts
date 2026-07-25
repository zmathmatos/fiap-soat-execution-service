import { DiagnosisPart, DiagnosisService } from "../value-objects/Diagnosis";
export interface OrderReceivedEvent {
    serviceOrderId: string;
    serviceOrderNumber: number;
}
export interface DiagnosticFinishedEvent {
    serviceOrderId: string;
    parts: DiagnosisPart[];
    services: DiagnosisService[];
}
export interface PaymentEvent {
    serviceOrderId: string;
}
export interface ExecutionFinishedEvent {
    serviceOrderId: string;
    finishedAt: string;
}
export interface ExecutionFailedEvent {
    serviceOrderId: string;
    reason: string;
    failedAt: string;
}

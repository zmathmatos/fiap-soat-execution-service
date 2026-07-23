import { randomUUID } from "crypto";
import { Diagnosis } from "../value-objects/Diagnosis";
import { InvalidTransitionError } from "../errors/InvalidTransitionError";
export enum ExecutionOrderStatus {
    IN_DIAGNOSIS_QUEUE = "IN_DIAGNOSIS_QUEUE",
    AWAITING_PAYMENT = "AWAITING_PAYMENT",
    IN_EXECUTION_QUEUE = "IN_EXECUTION_QUEUE",
    IN_EXECUTION = "IN_EXECUTION",
    FINISHED = "FINISHED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
interface ReceiveParams {
    serviceOrderId: string;
    serviceOrderNumber: number;
    queueSeq: number;
}
export interface ExecutionOrderState {
    id: string;
    serviceOrderId: string;
    serviceOrderNumber: number;
    status: ExecutionOrderStatus;
    diagnosis: Diagnosis | null;
    queueSeq: number | null;
    enqueuedAt: Date | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    failedAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export class ExecutionOrder {
    private constructor(private readonly state: ExecutionOrderState) { }
    static receive({ serviceOrderId, serviceOrderNumber, queueSeq }: ReceiveParams): ExecutionOrder {
        const now = new Date();
        return new ExecutionOrder({
            id: randomUUID(),
            serviceOrderId,
            serviceOrderNumber,
            status: ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE,
            diagnosis: null,
            queueSeq,
            enqueuedAt: now,
            startedAt: null,
            finishedAt: null,
            failedAt: null,
            failureReason: null,
            createdAt: now,
            updatedAt: now
        });
    }
    static restore(state: ExecutionOrderState): ExecutionOrder {
        return new ExecutionOrder({ ...state });
    }
    registerDiagnosis(diagnosis: Diagnosis): void {
        this.assertStatus(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE, "register diagnosis for");
        this.state.diagnosis = diagnosis;
        this.state.status = ExecutionOrderStatus.AWAITING_PAYMENT;
        this.state.queueSeq = null;
        this.touch();
    }
    enqueueForExecution(queueSeq: number): void {
        this.assertStatus(ExecutionOrderStatus.AWAITING_PAYMENT, "enqueue for execution");
        this.state.status = ExecutionOrderStatus.IN_EXECUTION_QUEUE;
        this.state.queueSeq = queueSeq;
        this.state.enqueuedAt = new Date();
        this.touch();
    }
    cancel(): void {
        this.assertStatus(ExecutionOrderStatus.AWAITING_PAYMENT, "cancel");
        this.state.status = ExecutionOrderStatus.CANCELLED;
        this.state.queueSeq = null;
        this.touch();
    }
    start(): void {
        this.assertStatus(ExecutionOrderStatus.IN_EXECUTION_QUEUE, "start");
        this.state.status = ExecutionOrderStatus.IN_EXECUTION;
        this.state.startedAt = new Date();
        this.state.queueSeq = null;
        this.touch();
    }
    finish(): void {
        this.assertStatus(ExecutionOrderStatus.IN_EXECUTION, "finish");
        this.state.status = ExecutionOrderStatus.FINISHED;
        this.state.finishedAt = new Date();
        this.touch();
    }
    fail(reason: string): void {
        this.assertStatus(ExecutionOrderStatus.IN_EXECUTION, "fail");
        this.state.status = ExecutionOrderStatus.FAILED;
        this.state.failedAt = new Date();
        this.state.failureReason = reason;
        this.touch();
    }
    private assertStatus(expected: ExecutionOrderStatus, action: string): void {
        if (this.state.status !== expected) {
            throw new InvalidTransitionError(this.state.status, action);
        }
    }
    private touch(): void {
        this.state.updatedAt = new Date();
    }
    get id(): string {
        return this.state.id;
    }
    get serviceOrderId(): string {
        return this.state.serviceOrderId;
    }
    get serviceOrderNumber(): number {
        return this.state.serviceOrderNumber;
    }
    get status(): ExecutionOrderStatus {
        return this.state.status;
    }
    get diagnosis(): Diagnosis | null {
        return this.state.diagnosis;
    }
    get queueSeq(): number | null {
        return this.state.queueSeq;
    }
    get enqueuedAt(): Date | null {
        return this.state.enqueuedAt;
    }
    get startedAt(): Date | null {
        return this.state.startedAt;
    }
    get finishedAt(): Date | null {
        return this.state.finishedAt;
    }
    get failedAt(): Date | null {
        return this.state.failedAt;
    }
    get failureReason(): string | null {
        return this.state.failureReason;
    }
    get createdAt(): Date {
        return this.state.createdAt;
    }
    get updatedAt(): Date {
        return this.state.updatedAt;
    }
    toState(): ExecutionOrderState {
        return { ...this.state };
    }
}

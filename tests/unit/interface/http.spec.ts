import request from "supertest";
import { buildApp, AppDependencies } from "../../../src/app";
import { EnqueueForDiagnosis } from "../../../src/application/use-cases/EnqueueForDiagnosis";
import { RegisterDiagnosis } from "../../../src/application/use-cases/RegisterDiagnosis";
import { EnqueueForExecution } from "../../../src/application/use-cases/EnqueueForExecution";
import { StartExecution } from "../../../src/application/use-cases/StartExecution";
import { FinishExecution } from "../../../src/application/use-cases/FinishExecution";
import { FailExecution } from "../../../src/application/use-cases/FailExecution";
import { GetQueue } from "../../../src/application/use-cases/GetQueue";
import { GetExecutionOrder } from "../../../src/application/use-cases/GetExecutionOrder";
import { InMemoryExecutionOrderRepository } from "../../fakes/InMemoryExecutionOrderRepository";
import { FakeEventPublisher } from "../../fakes/FakeEventPublisher";
function makeApp() {
    const repo = new InMemoryExecutionOrderRepository();
    const publisher = new FakeEventPublisher();
    const enqueueForDiagnosis = new EnqueueForDiagnosis(repo);
    const registerDiagnosis = new RegisterDiagnosis(repo);
    const enqueueForExecution = new EnqueueForExecution(repo);
    const deps: AppDependencies = {
        startExecution: new StartExecution(repo),
        finishExecution: new FinishExecution(repo, publisher),
        failExecution: new FailExecution(repo, publisher),
        getQueue: new GetQueue(repo),
        getExecutionOrder: new GetExecutionOrder(repo),
        health: async () => ({ database: true, rabbitmq: true })
    };
    const app = buildApp(deps);
    return { app, repo, publisher, enqueueForDiagnosis, registerDiagnosis, enqueueForExecution };
}
async function seedInExecutionQueue(ctx: ReturnType<typeof makeApp>, id: string, num: number) {
    await ctx.enqueueForDiagnosis.execute({ serviceOrderId: id, serviceOrderNumber: num });
    await ctx.registerDiagnosis.execute({ serviceOrderId: id, parts: [], services: [] });
    await ctx.enqueueForExecution.execute({ serviceOrderId: id });
}
describe("HTTP API", () => {
    it("GET /health returns service status", async () => {
        const { app } = makeApp();
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok", database: true, rabbitmq: true });
    });
    it("returns 500 for unexpected errors", async () => {
        const ctx = makeApp();
        jest.spyOn(ctx.repo, "findQueue").mockRejectedValueOnce(new Error("boom"));
        const res = await request(ctx.app).get("/api/queues/diagnosis");
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Internal server error" });
    });
    it("GET /api/queues/diagnosis returns the FIFO diagnosis queue", async () => {
        const ctx = makeApp();
        await ctx.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        await ctx.enqueueForDiagnosis.execute({ serviceOrderId: "os-2", serviceOrderNumber: 2 });
        const res = await request(ctx.app).get("/api/queues/diagnosis");
        expect(res.status).toBe(200);
        expect(res.body.map((i: {
            serviceOrderId: string;
        }) => i.serviceOrderId)).toEqual([
            "os-1",
            "os-2"
        ]);
    });
    it("GET /api/queues/execution returns the execution queue", async () => {
        const ctx = makeApp();
        await seedInExecutionQueue(ctx, "os-1", 1);
        const res = await request(ctx.app).get("/api/queues/execution");
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });
    it("GET /api/queues/unknown returns 422", async () => {
        const { app } = makeApp();
        const res = await request(app).get("/api/queues/bogus");
        expect(res.status).toBe(422);
    });
    it("GET /api/executions/:id returns order details", async () => {
        const ctx = makeApp();
        await ctx.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        const res = await request(ctx.app).get("/api/executions/os-1");
        expect(res.status).toBe(200);
        expect(res.body.serviceOrderId).toBe("os-1");
    });
    it("GET /api/executions/:id returns 404 for unknown order", async () => {
        const { app } = makeApp();
        const res = await request(app).get("/api/executions/ghost");
        expect(res.status).toBe(404);
        expect(res.body.error).toEqual(expect.any(String));
    });
    it("PATCH /start starts the head of the queue", async () => {
        const ctx = makeApp();
        await seedInExecutionQueue(ctx, "os-1", 1);
        const res = await request(ctx.app).patch("/api/executions/os-1/start");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("IN_EXECUTION");
    });
    it("PATCH /start on non-head returns 409", async () => {
        const ctx = makeApp();
        await seedInExecutionQueue(ctx, "os-1", 1);
        await seedInExecutionQueue(ctx, "os-2", 2);
        const res = await request(ctx.app).patch("/api/executions/os-2/start");
        expect(res.status).toBe(409);
    });
    it("PATCH /finish completes the repair and publishes execution.finished", async () => {
        const ctx = makeApp();
        await seedInExecutionQueue(ctx, "os-1", 1);
        await request(ctx.app).patch("/api/executions/os-1/start");
        const res = await request(ctx.app).patch("/api/executions/os-1/finish");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("FINISHED");
        expect(ctx.publisher.finished).toHaveLength(1);
    });
    it("PATCH /finish before start returns 409", async () => {
        const ctx = makeApp();
        await seedInExecutionQueue(ctx, "os-1", 1);
        const res = await request(ctx.app).patch("/api/executions/os-1/finish");
        expect(res.status).toBe(409);
    });
    it("PATCH /fail requires a reason", async () => {
        const ctx = makeApp();
        await seedInExecutionQueue(ctx, "os-1", 1);
        await request(ctx.app).patch("/api/executions/os-1/start");
        const res = await request(ctx.app).patch("/api/executions/os-1/fail").send({});
        expect(res.status).toBe(422);
    });
    it("PATCH /fail fails the repair and publishes execution.failed", async () => {
        const ctx = makeApp();
        await seedInExecutionQueue(ctx, "os-1", 1);
        await request(ctx.app).patch("/api/executions/os-1/start");
        const res = await request(ctx.app)
            .patch("/api/executions/os-1/fail")
            .send({ reason: "no parts" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("FAILED");
        expect(ctx.publisher.failed).toEqual([
            expect.objectContaining({ serviceOrderId: "os-1", reason: "no parts" })
        ]);
    });
});

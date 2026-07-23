import { Given, When, Then } from "@cucumber/cucumber";
import assert from "assert";
import { ExecutionWorld } from "../support/world";
import { ExecutionOrderStatus } from "../../src/domain/entities/ExecutionOrder";
import { NotHeadOfQueueError } from "../../src/domain/errors/NotHeadOfQueueError";
Given("que a ordem de serviço {string} foi recebida", async function (this: ExecutionWorld, alias: string) {
    await this.enqueueForDiagnosis.execute({
        serviceOrderId: alias,
        serviceOrderNumber: this.orderNumber(alias)
    });
});
When("o diagnóstico da {string} é finalizado com peças e serviços", async function (this: ExecutionWorld, alias: string) {
    await this.registerDiagnosis.execute({
        serviceOrderId: alias,
        parts: [{ id: "p1", name: "Pastilha de freio", quantity: 2, price: 150 }],
        services: [{ id: "s1", name: "Troca de pastilhas", price: 300 }]
    });
});
When("o pagamento da {string} é aprovado", async function (this: ExecutionWorld, alias: string) {
    await this.enqueueForExecution.execute({ serviceOrderId: alias });
});
When("o pagamento da {string} é recusado", async function (this: ExecutionWorld, alias: string) {
    await this.cancelExecution.execute({ serviceOrderId: alias });
});
When("o mecânico inicia o reparo da {string}", async function (this: ExecutionWorld, alias: string) {
    await this.startExecution.execute({ serviceOrderId: alias });
});
When("o mecânico finaliza o reparo da {string}", async function (this: ExecutionWorld, alias: string) {
    await this.finishExecution.execute({ serviceOrderId: alias });
});
When("o mecânico tenta iniciar o reparo da {string}", async function (this: ExecutionWorld, alias: string) {
    try {
        await this.startExecution.execute({ serviceOrderId: alias });
        this.lastError = null;
    }
    catch (error) {
        this.lastError = error as Error;
    }
});
Then("o status da {string} é {string}", async function (this: ExecutionWorld, alias, status) {
    const order = await this.repo.findByServiceOrderId(alias);
    assert.ok(order, `Ordem "${alias}" não encontrada`);
    assert.strictEqual(order.status, status);
});
Then("o evento {string} foi publicado para a {string}", function (this: ExecutionWorld, event: string, alias: string) {
    const published = event === "execution.finished" ? this.publisher.finished : this.publisher.failed;
    assert.ok(published.some((e) => e.serviceOrderId === alias), `Evento "${event}" não publicado para "${alias}"`);
});
Then("a fila de execução está vazia", async function (this: ExecutionWorld) {
    const queue = await this.repo.findQueue(ExecutionOrderStatus.IN_EXECUTION_QUEUE);
    assert.strictEqual(queue.length, 0);
});
Then("a operação é rejeitada por violar a ordem da fila", function (this: ExecutionWorld) {
    assert.ok(this.lastError instanceof NotHeadOfQueueError, "Esperava NotHeadOfQueueError");
});

# language: pt
Funcionalidade: Fila de execução de ordens de serviço
  Como oficina mecânica
  Quero processar ordens de serviço em filas FIFO de diagnóstico e execução
  Para garantir que os reparos sejam feitos na ordem de chegada

  Cenário: Fluxo completo — da recepção à finalização do reparo
    Dado que a ordem de serviço "OS-1" foi recebida
    Quando o diagnóstico da "OS-1" é finalizado com peças e serviços
    E o pagamento da "OS-1" é aprovado
    E o mecânico inicia o reparo da "OS-1"
    E o mecânico finaliza o reparo da "OS-1"
    Então o status da "OS-1" é "FINISHED"
    E o evento "execution.finished" foi publicado para a "OS-1"

  Cenário: Compensação da Saga — pagamento recusado cancela a execução
    Dado que a ordem de serviço "OS-2" foi recebida
    E o diagnóstico da "OS-2" é finalizado com peças e serviços
    Quando o pagamento da "OS-2" é recusado
    Então o status da "OS-2" é "CANCELLED"
    E a fila de execução está vazia

  Cenário: Ordem FIFO — reparo não pode furar a fila
    Dado que a ordem de serviço "OS-3" foi recebida
    E que a ordem de serviço "OS-4" foi recebida
    E o diagnóstico da "OS-3" é finalizado com peças e serviços
    E o diagnóstico da "OS-4" é finalizado com peças e serviços
    E o pagamento da "OS-3" é aprovado
    E o pagamento da "OS-4" é aprovado
    Quando o mecânico tenta iniciar o reparo da "OS-4"
    Então a operação é rejeitada por violar a ordem da fila
    E o status da "OS-4" é "IN_EXECUTION_QUEUE"

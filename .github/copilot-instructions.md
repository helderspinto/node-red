# Instruções do projeto

## Contexto
Dashboard web para monitorizar a temperatura de uma sala e sugerir ações de eficiência energética. As recomendações são apenas sugestões ao utilizador; o sistema nunca controla equipamentos.

## Arquitetura
- Sensores (ESP32) publicam medições via MQTT.
- Node-RED recebe, valida e guarda as medições e expõe uma API HTTP (JSON).
- O dashboard (HTML, CSS e JavaScript) consome essa API e apresenta medições, histórico e recomendações.
- Base de dados: SQLite.

## Dados disponíveis
- Temperatura por sensor, com timestamp.
- Ainda não existem dados de ocupação nem de portas/janelas. Qualquer regra que dependa deles deve ser assinalada como inferência.

## Regras gerais
- Responde e comenta código em português de Portugal.
- Explica as decisões de forma breve, sem repetir o código.
- Não inventes endpoints, tópicos MQTT ou campos de dados; se não estiverem definidos, pergunta.
- Usa dados simulados apenas em ficheiros identificados como tal (ex.: `mock-data.json`).
- Não coloques credenciais no código nem nos fluxos do Node-RED.

## Estado
Fase inicial. Prioridade atual: estrutura do dashboard com dados simulados.
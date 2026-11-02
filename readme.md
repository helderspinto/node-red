# Dashboard de Temperatura e Eficiência Energética

Este projeto destina-se a apresentar, numa página web, um dashboard com dados de sensores de temperatura instalados numa sala. O objetivo é facilitar a monitorização das condições do espaço e apoiar decisões que contribuam para reduzir o consumo de energia.

## Objetivos

- Consultar a temperatura medida pelos sensores da sala.
- Acompanhar a evolução das medições ao longo do tempo.
- Identificar condições que possam estar a causar um consumo energético desnecessário.
- Apresentar ações recomendadas para melhorar a eficiência energética.

## Ações a considerar

Consoante os dados disponíveis e as condições da sala, o dashboard poderá sugerir medidas como:

- Ajustar a temperatura definida no sistema de climatização.
- Reduzir o aquecimento ou arrefecimento quando a sala não estiver ocupada.
- Verificar portas e janelas quando as temperaturas forem inesperadas.
- Comparar medições ao longo do tempo para avaliar o efeito das alterações.

As recomendações destinam-se a apoiar o utilizador. Não implicam o controlo automático dos equipamentos.

## Estado do projeto

A página consulta `GET /api/privado/leituras` no mesmo host. A API exige autenticação por token Bearer no cabeçalho `Authorization` e devolve uma lista de leituras no formato `{ "nome": "ana", "ts": 1793626117705, "valor": 22.72 }`. `ts` é um instante em milissegundos. O painel mostra o nome associado às leituras, destaca a mais recente, assinala leituras com mais de cinco minutos e representa num gráfico as leituras das últimas 24 horas. O token é guardado em `sessionStorage` durante a sessão do separador.

## Matriz de permissões

| Perfil / estado | Operações permitidas | Dados acessíveis |
|---|---|---|
| Visitante sem token válido | Nenhuma na API privada; o pedido sem credenciais válidas recebe `401` | Nenhuma leitura |
| Utilizador autenticado com token válido | Consultar (`GET`) `/api/privado/leituras` | Apenas as leituras associadas ao seu token, com `nome`, `ts` e `valor` |

O contrato disponível não define outros perfis, nem operações para criar, alterar ou apagar leituras. Por isso, não são atribuídas permissões adicionais nesta matriz.

## Política de retenção de dados

| Idade da medição | Resolução conservada | Regra |
|---|---|---|
| Até 30 dias | Leitura individual, à resolução original do sensor | Manter `nome`, `ts` e `valor` para acompanhar alterações recentes e diagnosticar problemas. |
| Mais de 30 dias e até 12 meses | Uma média horária por utilizador | Calcular a média das leituras da hora e eliminar as leituras individuais desse período. |
| Mais de 12 meses | Nenhuma | Eliminar também as médias horárias. |

O prazo conta-se desde o instante da medição (`ts`). A resolução original não é fixada em minutos porque a frequência de publicação dos sensores não está especificada; não se deve reamostrar nem inventar leituras para preencher intervalos sem medições. As médias são calculadas separadamente por utilizador, sem combinar dados de utilizadores diferentes.

Esta política conserva detalhe recente, útil para diagnóstico, e permite observar tendências ao longo de um ciclo anual através de dados menos granulares. A redução da resolução e a eliminação após 12 meses limitam a quantidade e o detalhe dos dados pessoais mantidos. A camada de armazenamento deve executar a agregação e a eliminação nos prazos indicados; a existência desta documentação, por si só, não confirma que esses processos já estejam implementados.
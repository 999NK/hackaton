# Scanner upload contract

## Contrato encontrado

Antes desta revisao o receptor aceitava `POST /api/scanner`, `POST /backend/v1/scanner` e `POST /backend/v1/api/scanner` apenas como JSON simples. O token era lido somente de `Authorization: Bearer <token>`. O corpo inteiro, ou `body.report`, era salvo em `scans.report`, o scan era marcado como `COMPLETED` imediatamente e o token era persistido em `scans.token`.

Nao havia suporte a `multipart/form-data`, nem persistencia separada de artefatos. `.skip-report.json`, `.skip-sam.json`, `.skip-wcag-audit.json`, manifestos e arquivos condicionais nao eram tratados por tipo. O dashboard consumia principalmente `scans.report`, e entidades/relacionamentos so eram preenchidos pelo fluxo manual.

| Item | Implementacao anterior |
|---|---|
| Metodo HTTP | `POST` |
| Endpoint | `/api/scanner`, `/backend/v1/scanner`, `/backend/v1/api/scanner` |
| Content-Type | `application/json` |
| Autenticacao | `Authorization: Bearer <token>` |
| Header do token | `Authorization` |
| Campos do body | `report` ou corpo inteiro legado |
| Campos multipart | Nao suportado |
| Arquivos aceitos | Nenhum arquivo real |
| Quantidade maxima | Nao definida |
| Tamanho maximo | 10 MB JSON via Express |
| Resposta atual | `{ "scanId": "..." }` |

## Contrato implementado

O endpoint canonico continua sendo:

```http
POST /backend/v1/api/scanner
```

Aliases mantidos:

```http
POST /api/scanner
POST /backend/v1/scanner
```

O scanner pode enviar `multipart/form-data` ou JSON equivalente.

Autenticacao canonica:

```http
Authorization: Bearer <project-token>
```

Compatibilidade temporaria:

- `x-skip-token`
- `?token=...`
- `token` no JSON body
- `token` como campo multipart

O token nao e gravado em novos scans, nao volta em respostas e so aparece mascarado nos metadados observados.

### Multipart

Campos de texto:

- `scanId`
- `schemaVersion`
- `bundleVersion`
- `manifest`

Arquivos:

- `artifacts[]`

Artefatos obrigatorios:

| Filename | Tipo logico | Obrigatorio | Funcao |
|---|---|---:|---|
| `.skip-report.json` | `report` | Sim | Metadados e resumo do scan |
| `.skip-sam.json` | `semantic-map` | Sim | Semantic Application Map |
| `.skip-wcag-audit.json` | `wcag-audit` | Sim | Auditoria WCAG |
| `scan-file-manifest.json` | `file-manifest` | Sim | Arquivos analisados |
| `upload-manifest.json` | `upload-manifest` | Sim | Integridade do bundle |
| `scan-validation.json` | `validation` | Sim | Validacoes feitas pelo scanner |
| `scan-source-files.json` | `source-files` | Condicional | Contexto autorizado |
| `scan-source-files.part-*.json` | `source-files` | Condicional | Partes de contexto autorizado |
| `scanner-diagnostics.json` | `diagnostics` | Nao | Diagnostico tecnico |
| `scanner.log` | `scanner-log` | Nao | Log tecnico |
| `.skip-wcag-audit.cjs` | `debug-source` | Nao recomendado | Nunca executado |

### JSON equivalente

```json
{
  "scanId": "scan_xxx",
  "schemaVersion": "1.0.0",
  "bundleVersion": "1.0.0",
  "artifacts": [
    {
      "artifactType": "semantic-map",
      "filename": ".skip-sam.json",
      "contentType": "application/json",
      "content": {
        "entities": [],
        "relationships": []
      }
    }
  ]
}
```

Envio isolado de SAM tambem e aceito:

```json
{
  "scanId": "scan_xxx",
  "artifactType": "semantic-map",
  "filename": ".skip-sam.json",
  "payload": {
    "entities": [],
    "relationships": []
  }
}
```

## Processamento

O backend agora centraliza:

- `detectArtifactType()`
- `validateArtifact()`
- `persistArtifact()`
- processamento por tipo

`.skip-sam.json` e reconhecido por nome fisico e/ou `artifactType: "semantic-map"`, mas o nome fisico correto continua obrigatorio. O SAM nao exige `navigationMap`, `routes` ou `wcag`; ele exige somente JSON object com `entities` e `relationships`, IDs unicos e relacionamentos apontando para entidades existentes.

`.skip-wcag-audit.json` preserva findings, severidades `critical`, `serious`, `moderate`, `minor` e `unknown`, source location, selector, sugestao e telas afetadas. `unknown` continua sem virar `minor`.

`upload-manifest.json` e usado para comparar arquivos esperados, recebidos, hashes e tamanhos quando informados.

Arquivos fonte e `.cjs` sao tratados somente como dados. O backend nao executa, importa, avalia nem carrega esses arquivos como modulo.

## Persistencia

Novos campos em `scans`:

- `external_scan_id`
- `expected_artifacts`
- `received_artifacts`
- `valid_artifacts`
- `scanner_version`
- `schema_version`
- `bundle_version`
- `completed_at`

Novas tabelas:

- `scan_artifacts`: conteudo bruto, tipo, filename, hash, tamanho, status de validacao/processamento.
- `wcag_findings`: findings normalizados por scan.

O SAM processado alimenta `semantic_entities` e `relationships`, que seguem como fonte do mapa semantico usado pelo dashboard/widget.

## Estados

Status geral:

- `COMPLETED`: todos os seis artefatos obrigatorios chegaram, validaram, persistiram e processaram.
- `PARTIAL`: upload aceito, mas faltam artefatos obrigatorios.
- `FAILED`: algum artefato recebido e invalido.

Campos derivados em `scans.report.upload`:

- `uploadStatus`
- `validationStatus`
- `processingStatus`
- `reportStatus`
- `samStatus`
- `wcagStatus`
- `dashboardStatus`

Quando faltam dados suficientes para score:

```json
{ "scoreStatus": "unavailable" }
```

## Resposta

Resposta de sucesso aceita:

```json
{
  "scanId": "uuid-interno",
  "externalScanId": "scan_xxx",
  "accepted": true,
  "status": "complete",
  "expectedArtifacts": 6,
  "receivedArtifacts": 6,
  "validArtifacts": 6,
  "persistedArtifacts": 6,
  "artifacts": [],
  "missingArtifacts": [],
  "invalidArtifacts": [],
  "hashMismatches": [],
  "warnings": []
}
```

Envio legado com apenas `.skip-report.json` retorna `partial` e lista os obrigatorios ausentes, sem inventar SAM, auditoria WCAG ou score final.

## Seguranca

- Token nao e persistido em novos scans.
- Token nao e retornado.
- Token nao e registrado em erros.
- `.skip-wcag-audit.cjs` nunca e executado.
- Arquivos fonte sao armazenados somente como dados.
- Limite de multipart: 25 MB por requisicao.

## Testes

O teste `server/__tests__/scanner-upload.test.js` cobre:

- endpoint correto;
- token ausente e invalido;
- JSON legado parcial;
- envio isolado de `.skip-sam.json`;
- multipart com os seis artefatos obrigatorios;
- preservacao do nome `.skip-sam.json`;
- SAM sem `navigationMap`, `routes` ou `wcag`;
- processamento de entidades e relacionamentos;
- persistencia de artefatos;
- persistencia de findings WCAG com `serious` e `unknown`.

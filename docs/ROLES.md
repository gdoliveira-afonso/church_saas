# Perfis e Permissões

## Roles Primários

Cada usuário possui exatamente um role primário, definido no campo `User.role`.

| Role            | Label              | Acesso                                                                                      |
|-----------------|--------------------|---------------------------------------------------------------------------------------------|
| `SUPERADMIN`    | Super Admin        | Acesso total a todas as organizações. Gerencia planos, slug, status e configurações globais. |
| `ADMIN`         | Administrador      | Acesso total à própria organização. Gerencia usuários, módulos, configurações e dados.       |
| `SUPERVISOR`    | Supervisor         | Acesso amplo: visualiza e gerencia membros, células, relatórios, EBD e financeiro.           |
| `LIDER_GERACAO` | Líder de Geração   | Gerencia as células da sua geração. Visualiza pessoas e relatórios da geração.               |
| `LEADER`        | Líder de Célula    | Gerencia sua própria célula: membros, chamadas, eventos.                                     |
| `VICE_LEADER`   | Vice-Líder         | Mesmas permissões do LEADER, com escopo limitado à célula associada.                         |
| `USER`          | Colaborador        | Acesso restrito ao módulo EBD. Usado para professores sem papel pastoral.                    |

### Notas sobre roles primários

- Ao criar um usuário com role `LEADER`, `VICE_LEADER` ou `LIDER_GERACAO`, um registro `Person` é criado automaticamente e vinculado ao usuário (`Person.userId`).
- `SUPERADMIN` não pertence a nenhuma organização; os demais roles pertencem a uma `Organization`.
- Role `USER` ao fazer login é redirecionado para `/ebd` (não para o dashboard).

---

## SecondaryRoles (Módulos Especiais)

O campo `User.secondaryRoles` é um JSON array de strings que concede permissões adicionais em módulos específicos, independente do role primário.

| SecondaryRole          | Módulo     | Permissões concedidas                                                                              |
|------------------------|------------|----------------------------------------------------------------------------------------------------|
| `PROFESSOR`            | EBD        | Acesso às classes onde é professor (1º professor). Pode realizar chamada e registrar ofertas.       |
| `SEGUNDO_PROFESSOR`    | EBD        | Mesmo acesso do PROFESSOR, mas como segundo professor da classe.                                    |
| `SUPERINTENDENTE_EBD`  | EBD        | Acesso administrativo total ao módulo EBD da organização (todas as classes, relatórios, dados).    |
| `AGENTE_FINANCEIRO`    | Financeiro | Acesso completo ao módulo financeiro: contas, fundos, transações, dízimos, contas a pagar, relatórios. |

### Guards EBD

| Guard                      | Quem passa                                                    |
|----------------------------|---------------------------------------------------------------|
| `hasEbdAdminAccess`        | ADMIN, SUPERVISOR, SUPERADMIN, ou secondaryRole SUPERINTENDENTE_EBD |
| `hasEbdStrictAdminAccess`  | ADMIN, SUPERADMIN, ou secondaryRole SUPERINTENDENTE_EBD (exclui SUPERVISOR) |

### Guard Financeiro

| Guard               | Quem passa                                                         |
|---------------------|--------------------------------------------------------------------|
| `hasFinanceAccess`  | ADMIN, SUPERVISOR, ou secondaryRole AGENTE_FINANCEIRO              |

---

## Regras de Negócio Importantes

### Auto-criação de Person

Ao criar um `User` com role `LEADER`, `VICE_LEADER` ou `LIDER_GERACAO`, um registro `Person` é automaticamente criado e vinculado via `Person.userId`. Isso permite que líderes também sejam membros cadastrados na base.

### Participação em célula (Person.cellId)

`Person.cellId` representa a célula em que a pessoa participa como membro. Isso é independente de `Cell.leaderId` ou `Cell.viceLeaderId`. Um líder pode participar como membro de uma célula diferente da que ele lidera.

### Professor de EBD

Professor é um `User` com secondaryRole `PROFESSOR` — **não** é um registro `Person`. Os selects de professor nas classes EBD usam `User.id`, não `Person.id`.

### Cascade delete de organização

Ao deletar uma organização, todos os dados relacionados são removidos em transação, incluindo a cadeia do módulo EBD: `EbdAttendanceRecord → EbdAttendance → EbdOffering → EbdStudent → EbdClass`.

### Invalidação de tokens JWT

Cada `User` possui um campo `tokenVersion`. Ao alterar a senha ou deslogar forçadamente, `tokenVersion` é incrementado, invalidando todos os tokens anteriores daquele usuário.

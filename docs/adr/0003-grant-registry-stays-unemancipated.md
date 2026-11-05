# Household names are "forever", but each household's grant registry is not emancipated

ENS's brief rewards "forever" names that no parent controls, so the obvious move is to emancipate everything. We emancipate `pata.eth`'s registry, which holds `sana`, and lock `pata.eth`'s subregistry pointer, so the provider can't take a household name back. Each household's own grant registry stays un-emancipated on purpose. Its root `ROLE_UNREGISTER` is the household's power to revoke grants, and ENS counts that role as one that blocks emancipation (`UNEMANCIPATED_ROLE_BITMAP`). The household holds that role, not the provider.

## Consequences

- An emancipated `pata.eth` registry can never be upgraded (`ROLE_UPGRADE` also blocks emancipation), so its roles are set right at kick-off.
- Every household name still depends on `pata.eth` staying registered. Register it for several years; anyone can renew it.
- Source: `docs/research/ens-v2.md` (flows 2–4, Gotchas 6 and 7).

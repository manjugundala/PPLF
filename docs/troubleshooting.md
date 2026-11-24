# Troubleshooting

## Nothing is logged

| Check | How |
|---|---|
| Is the source enabled and the level high enough? | PPLF Configuration App → Settings. The `*` row applies when there's no row for the source. Remember the source name must match exactly (case is ignored). |
| Are the flows on? | Solutions → PPLF → Cloud flows. Turn on children first: writers, router, then the rest. |
| Are the connection references set? | Solutions → PPLF → Connection references. Each needs a connection owned by an account that will stay. |
| Canvas Direct mode | Look at `colPplfFailed` in Studio (Variables → Collections). |
| Canvas Router mode | Look at `colPplfBuffer`; open the *Ingest from Power Apps* run history. |
| Power Pages | Browser console shows `[PPLF]` warnings. Check the flow is added to the site and the visitor has one of its web roles. |
| Model-driven | Browser console shows `[PPLF] could not write log`. The user probably lacks **PPLF | Log Writer**. |

## The router writes to the wrong place

Environment variable values are cached briefly. Wait a few minutes after changing `pplf_LogTarget`. Make sure the value is set on the **current value**, not only the default, and that there is exactly one value row (the Admin app's Setup screen shows what flows see).

## SharePoint writer fails with 400 or "column does not exist"

The list was created by hand or by an older version. Run **Setup → Create lists** again (it adds missing columns), or run `PplfDeployer.provisionSharePoint()` on the site.

## "The child flow can't be called" / "Run a Child Flow" can't find the PPLF flows

Your flow must be in a solution, and PPLF's flows must be on. Child flows also need their connections set to *Use this connection* (embedded), not run-only users.

## Retention doesn't delete everything

Each rule deletes up to 5,000 entries per run. See [retention](retention-and-alerts.md).

## Power Pages: 403 from `/_api/cloudflow`

The visitor isn't in a web role assigned to the flow, or the flow connection lost its sharing. Re-add the flow under **Set up → Cloud flows**.

## Plug-in entries disappear

See [the transaction caveat](plugins.md#the-transaction-caveat). Check the plug-in trace log.

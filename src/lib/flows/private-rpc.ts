// Starts the Anon-RPC worker when any page opens (P0-5 follow-up, 2026-11-07).
// Its bootstrap takes 4–25 s; started early, it's done before the first read the household waits on.
export { warmUpPrivateRpc as startPrivateRpc } from "../rpc";

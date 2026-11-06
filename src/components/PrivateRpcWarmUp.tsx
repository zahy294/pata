"use client";
// Renders nothing. Starts Nox once per visit so the first chain read doesn't also pay for its bootstrap.
import { useEffect } from "react";
import { startPrivateRpc } from "../lib/flows/private-rpc";

export default function PrivateRpcWarmUp() {
  useEffect(() => {
    startPrivateRpc();
  }, []);
  return null;
}

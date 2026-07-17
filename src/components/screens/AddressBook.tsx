"use client";
// Address Book — saved contacts for Send's recipient picker.
import { isAddress } from "ethers";
import { useState } from "react";

import { Box, Btn, Divider, Header, Lbl, shortAddr } from "@/components/ui";
import { useWallet } from "@/store/wallet";

const inputCls =
  "w-full rounded-none border border-[var(--av-text)] p-2 text-[12px] outline-none placeholder:text-[var(--av-text-3)] focus:border-[var(--av-red)]";

export function AddressBook() {
  const s = useWallet();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    setError("");
    if (!name.trim()) {
      setError("Enter a name");
      return;
    }
    if (!isAddress(address)) {
      setError("Invalid address");
      return;
    }
    s.addContact({ name: name.trim(), address });
    setName("");
    setAddress("");
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Address Book" onBack={() => s.navigate({ name: "settings" })} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {s.contacts.length === 0 && <Lbl>No saved contacts</Lbl>}
        {s.contacts.map((c) => (
          <Box key={c.address} className="flex items-center justify-between p-3">
            <div>
              <div className="text-[12px] font-bold">{c.name}</div>
              <Lbl>{shortAddr(c.address)}</Lbl>
            </div>
            <button
              type="button"
              className="cursor-pointer text-[11px] text-[var(--av-red)]"
              onClick={() => s.removeContact(c.address)}
            >
              Remove
            </button>
          </Box>
        ))}
      </div>
      <Divider />
      <div className="flex flex-col gap-2 p-4">
        <input
          className={inputCls}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
        />
        {error && <Lbl className="text-[var(--av-red)]">{error}</Lbl>}
        <Btn primary className="w-full" onClick={add}>
          Add Contact
        </Btn>
      </div>
    </div>
  );
}

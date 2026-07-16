"use client";
// 09 · Settings
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Avatar, Box, Divider, Hd, Lbl, shortAddr } from "@/components/ui";
import { AVATAR_STYLES, type AvatarStyle } from "@/lib/avatar";
import { profileFor, useWallet, walletProvider } from "@/store/wallet";

const rowCls =
  "flex w-full cursor-pointer items-center justify-between border-b border-[#eee] py-[10px] text-[11px]";
const inputCls =
  "w-full rounded-[12px] border border-[#e4e4e4] p-2 text-[12px] outline-none placeholder:text-[#aaa]";

const AUTO_LOCK_OPTIONS = [1, 5, 15, 30, 60];

export function Settings() {
  const s = useWallet();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const account = s.accounts[s.activeIndex];
  const profile = account ? profileFor(s.profiles, account.address) : null;
  const [username, setUsernameLocal] = useState(profile?.username ?? "");

  const changePassword = async () => {
    if (pwNext.length < 8) {
      setPwMsg("New password: min 8 characters");
      return;
    }
    try {
      await walletProvider.changePassword(pwCurrent, pwNext);
      setPwMsg("Password changed ✓");
      setPwCurrent("");
      setPwNext("");
    } catch {
      setPwMsg("Current password incorrect");
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 py-[14px]">
        <Hd>Settings</Hd>
      </div>
      <Divider />
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-2">
        <Lbl className="pt-[10px] pb-1">Wallet</Lbl>
        <button className={rowCls} onClick={() => setAccountsOpen((v) => !v)}>
          <div>{account?.name}</div>
          <Lbl>{account && shortAddr(account.address)} ›</Lbl>
        </button>
        {accountsOpen && (
          <Box className="my-1">
            {s.accounts.map((a) => (
              <button
                key={a.index}
                className="flex w-full cursor-pointer justify-between border-b border-[#eee] px-3 py-2 text-[11px]"
                onClick={() => s.setActiveIndex(a.index)}
              >
                <div>
                  {a.name} {a.index === s.activeIndex && "✓"}
                </div>
                <Lbl>{shortAddr(a.address)}</Lbl>
              </button>
            ))}
            <button
              className="block w-full cursor-pointer px-3 py-2 text-left text-[11px]"
              onClick={() => void s.addAccount()}
            >
              + Add Account
            </button>
          </Box>
        )}
        <button className={rowCls} onClick={() => setProfileOpen((v) => !v)}>
          <div>Edit Profile</div>
          <Lbl>›</Lbl>
        </button>
        {profileOpen && profile && account && (
          <Box className="my-1 flex flex-col gap-3 p-3">
            <div className="flex items-center gap-3">
              <Avatar seed={profile.avatarSeed} style={profile.avatarStyle} size={48} />
              <button
                type="button"
                className="cursor-pointer text-[10px] text-[#888] underline"
                onClick={() => s.regenerateAvatar(account.address)}
              >
                Regenerate avatar
              </button>
            </div>
            <div>
              <Lbl className="mb-[6px]">Username</Lbl>
              <input
                className={inputCls}
                placeholder={account.name}
                value={username}
                onChange={(e) => setUsernameLocal(e.target.value)}
                onBlur={() => s.setUsername(account.address, username.trim())}
              />
            </div>
            <div>
              <Lbl className="mb-[6px]">Avatar Style</Lbl>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(AVATAR_STYLES) as AvatarStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    className="flex cursor-pointer justify-center"
                    onClick={() => s.setAvatarStyle(account.address, style)}
                  >
                    <Avatar
                      seed={profile.avatarSeed}
                      style={style}
                      size={36}
                      className={
                        style === profile.avatarStyle ? "ring-2 ring-[#111] ring-offset-1" : ""
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="cursor-pointer text-left text-[10px] text-[#b00]"
              onClick={() => {
                s.resetProfile(account.address);
                setUsernameLocal("");
              }}
            >
              Reset to default
            </button>
          </Box>
        )}
        <button className={rowCls} onClick={() => s.navigate({ name: "privacy" })}>
          <div>Privacy &amp; Security</div>
          <Lbl>›</Lbl>
        </button>
        <button className={rowCls} onClick={() => s.navigate({ name: "backup" })}>
          <div>Recovery Phrase</div>
          <Lbl>›</Lbl>
        </button>

        <Lbl className="pt-[10px] pb-1">Network</Lbl>
        <div className="flex gap-2 py-[6px]">
          {(["fuji", "mainnet"] as const).map((id) => (
            <button
              key={id}
              onClick={() => s.setNetwork(id)}
              className={`flex-1 cursor-pointer rounded-[12px] border p-2 text-center text-[10px] capitalize ${
                s.networkId === id ? "border-[#111] bg-[#111] text-white" : "border-[#e4e4e4]"
              }`}
            >
              {id === "fuji" ? "Fuji" : "Mainnet"}
            </button>
          ))}
        </div>

        <Lbl className="pt-[10px] pb-1">Security</Lbl>
        <button className={rowCls} onClick={() => setPwOpen((v) => !v)}>
          <div>Change Password</div>
          <Lbl>›</Lbl>
        </button>
        {pwOpen && (
          <Box className="my-1 flex flex-col gap-2 p-3">
            <input
              type="password"
              className={inputCls}
              placeholder="Current password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
            />
            <input
              type="password"
              className={inputCls}
              placeholder="New password (min 8)"
              value={pwNext}
              onChange={(e) => setPwNext(e.target.value)}
            />
            {pwMsg && <Lbl>{pwMsg}</Lbl>}
            <button
              className="cursor-pointer rounded-[12px] bg-[#111] py-2 text-[10px] font-bold text-white"
              onClick={changePassword}
            >
              Update Password
            </button>
          </Box>
        )}
        <button className={rowCls} onClick={() => setLockOpen((v) => !v)}>
          <div>Auto-lock Timer</div>
          <Lbl>{s.autoLockMinutes} min ›</Lbl>
        </button>
        {lockOpen && (
          <div className="flex gap-2 py-[6px]">
            {AUTO_LOCK_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  s.setSetting("autoLockMinutes", m);
                  setLockOpen(false);
                }}
                className={`flex-1 cursor-pointer rounded-[12px] border p-2 text-center text-[10px] ${
                  s.autoLockMinutes === m
                    ? "border-[#111] bg-[#111] text-white"
                    : "border-[#e4e4e4]"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        )}

        <Lbl className="pt-[10px] pb-1">Developer</Lbl>
        <div className="flex items-center justify-between py-[10px] text-[11px]">
          <div>Developer Mode</div>
          <button
            onClick={() => s.setSetting("developerMode", !s.developerMode)}
            className={`relative h-[18px] w-8 cursor-pointer rounded-[10px] border border-[#111] ${
              s.developerMode ? "bg-[#111]" : ""
            }`}
          >
            <div
              className={`absolute top-[2px] h-3 w-3 rounded-full ${
                s.developerMode ? "right-[2px] bg-white" : "left-[2px] bg-[#111]"
              }`}
            />
          </button>
        </div>
        {s.developerMode && account && (
          <Box className="mb-2 p-3">
            <Lbl>Address</Lbl>
            <div className="text-[10px] break-all">{account.address}</div>
            <Lbl className="mt-2">Derivation</Lbl>
            <div className="text-[10px]">m/44&apos;/60&apos;/0&apos;/0/{account.index}</div>
          </Box>
        )}
      </div>
      <BottomNav active="settings" />
    </div>
  );
}

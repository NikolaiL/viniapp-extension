"use client";

// @refresh reset
import { useEffect, useState } from "react";
import { AddressInfoDropdown } from "./AddressInfoDropdown";
import { AddressQRCodeModal } from "./AddressQRCodeModal";
import { RevealBurnerPKModal } from "./RevealBurnerPKModal";
import { WrongNetworkDropdown } from "./WrongNetworkDropdown";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Balance } from "@scaffold-ui/components";
import { getBlockExplorerAddressLink } from "@scaffold-ui/hooks";
import { Address } from "viem";
import { useAccount } from "wagmi";
import { useNetworkColor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 * Custom Wagmi Connect Button (watch balance + custom design).
 *
 * ViniApp override: the "Connect Wallet" button is hidden while wagmi is still
 * resolving the auto-connect (status "connecting"/"reconnecting", plus a short
 * grace window after mount) so a returning user's wallet reconnects inside the
 * Base App / MiniPay / Farcaster without the button flashing first. It is only
 * revealed once wagmi has settled to "disconnected" — i.e. we know there is no
 * wallet to restore.
 */
export const RainbowKitCustomConnectButton = () => {
  const networkColor = useNetworkColor();
  const { targetNetwork } = useTargetNetwork();
  const { status } = useAccount();

  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGraceElapsed(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const resolvingConnection =
    status === "connecting" || status === "reconnecting" || (!graceElapsed && status !== "connected");

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        const blockExplorerAddressLink = account
          ? getBlockExplorerAddressLink(targetNetwork, account.address)
          : undefined;

        return (
          <>
            {(() => {
              if (!connected) {
                // Still resolving auto-connect — show a disabled placeholder (same
                // footprint, no layout shift) instead of the Connect button.
                if (resolvingConnection) {
                  return (
                    <button className="btn btn-primary btn-sm" type="button" disabled>
                      <span className="loading loading-spinner loading-xs" />
                      Connecting…
                    </button>
                  );
                }
                return (
                  <button className="btn btn-primary btn-sm" onClick={openConnectModal} type="button">
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported || chain.id !== targetNetwork.id) {
                return <WrongNetworkDropdown />;
              }

              return (
                <>
                  <div className="flex flex-col items-center mr-2">
                    <Balance
                      address={account.address as Address}
                      style={{
                        minHeight: "0",
                        height: "auto",
                        fontSize: "0.8em",
                      }}
                    />
                    <span className="text-xs" style={{ color: networkColor }}>
                      {chain.name}
                    </span>
                  </div>
                  <AddressInfoDropdown
                    address={account.address as Address}
                    displayName={account.displayName}
                    ensAvatar={account.ensAvatar}
                    blockExplorerAddressLink={blockExplorerAddressLink}
                  />
                  <AddressQRCodeModal address={account.address as Address} modalId="qrcode-modal" />
                  <RevealBurnerPKModal />
                </>
              );
            })()}
          </>
        );
      }}
    </ConnectButton.Custom>
  );
};

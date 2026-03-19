// Reference the example args file: https://github.com/scaffold-eth/create-eth-extensions/blob/example/extension/packages/nextjs/app/page.tsx.args.mjs
// Reference the template file that will use this file: https://github.com/scaffold-eth/create-eth/blob/main/templates/base/packages/nextjs/app/page.tsx.template.mjs

export const fullContentOverride = `
"use client";

import type { NextPage } from "next";
import { useMiniapp } from "~~/components/MiniappProvider";

const Home: NextPage = () => {
  const { context, isMiniApp, isReady } = useMiniapp();
  const user = context.user;

  return (
    <div className="flex flex-col items-center w-full px-4 py-8 pb-24">
      <div className="w-full max-w-md text-center">
        {isReady && user?.pfpUrl && (
          <div className="flex flex-col items-center py-6">
            <img src={user.pfpUrl} className="w-20 h-20 rounded-full ring-4 ring-primary" alt="Profile" />
            <h2 className="text-xl font-bold mt-3">{user.displayName || user.username}</h2>
            {user.username && <p className="text-base-content/60">@{user.username}</p>}
          </div>
        )}

        <h1 className="text-4xl font-bold mb-4">
          {process.env.NEXT_PUBLIC_APP_NAME || "ViniApp"}
        </h1>
        <p className="text-base-content/70 mb-8">
          {process.env.NEXT_PUBLIC_APP_TAGLINE || "Built with Scaffold-ETH 2 + MiniApp Extension"}
        </p>

        <div className="card bg-base-200 rounded-xl p-6">
          <p className="text-sm text-base-content/60">
            {isMiniApp ? "Running inside Farcaster" : "Running in browser"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
`;

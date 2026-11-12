"use client";

import {
  INSTANCE_LOADING_STATE,
  PayPalOneTimePaymentButton,
  PayPalProvider,
  usePayPal,
} from "@paypal/react-paypal-js/sdk-v6";
import { FlaskConical, Loader2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRuntimeConfig } from "@/lib/client/config";
import type { CreatedOrder } from "@/lib/domain/api";
import { STORE } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/domain/money";

// Checkout button. With sandbox keys it is the real PayPal JS SDK v6 button;
// without keys a clearly labelled local simulator runs the same server flow
// (create order → buyer approval → capture), so the demo always works.

export interface CheckoutHandlers {
  totalCents: number;
  disabled: boolean;
  /** Creates the order on our server, which prices it from the catalogue. */
  createOrder: () => Promise<CreatedOrder>;
  /** Captures the approved order on our server. */
  capture: (paypalOrderId: string) => Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
}

function ButtonSkeleton() {
  return <div className="h-12 w-full animate-pulse rounded-full bg-white/[0.06]" />;
}

export function PayPalCheckout(props: CheckoutHandlers) {
  const config = useRuntimeConfig();
  if (!config) return <ButtonSkeleton />;

  if (config.paypal.mode === "sandbox" && config.paypal.clientId) {
    return (
      <PayPalProvider
        clientId={config.paypal.clientId}
        environment="sandbox"
        components={["paypal-payments"]}
        pageType="checkout"
      >
        <SandboxButton {...props} />
      </PayPalProvider>
    );
  }
  return <SimulatedButton {...props} />;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The payment didn't go through. Please try again.";
}

function SandboxButton({ disabled, createOrder, capture, onCancel, onError }: CheckoutHandlers) {
  const { loadingStatus, error } = usePayPal();

  if (loadingStatus === INSTANCE_LOADING_STATE.PENDING) return <ButtonSkeleton />;
  if (loadingStatus === INSTANCE_LOADING_STATE.REJECTED) {
    return (
      <p className="rounded-2xl bg-kai/10 p-3 text-sm text-kai">
        PayPal couldn&apos;t load{error?.message ? `: ${error.message}` : "."} Check your connection and reopen the bag.
      </p>
    );
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : ""}>
      <PayPalOneTimePaymentButton
        type="pay"
        disabled={disabled}
        createOrder={async () => {
          try {
            const order = await createOrder();
            return { orderId: order.paypalOrderId };
          } catch (cause) {
            onError(errorMessage(cause));
            throw cause;
          }
        }}
        onApprove={async ({ orderId }) => {
          try {
            await capture(orderId);
          } catch (cause) {
            onError(errorMessage(cause));
          }
        }}
        onCancel={onCancel}
        onError={(cause) => onError(errorMessage(cause))}
      />
    </div>
  );
}

function SimulatedButton({ totalCents, disabled, createOrder, capture, onCancel, onError }: CheckoutHandlers) {
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [working, setWorking] = useState(false);

  const start = async () => {
    setWorking(true);
    try {
      setOrder(await createOrder());
    } catch (cause) {
      onError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  };

  const approve = async () => {
    if (!order) return;
    setWorking(true);
    try {
      await capture(order.paypalOrderId);
      setOrder(null);
    } catch (cause) {
      onError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={disabled || working}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-paypal font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-50"
      >
        {working && !order ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
        Pay {formatMoney(totalCents)} · PayPal simulator
      </button>

      {order && (
        <SimulatorApproval
          order={order}
          working={working}
          onApprove={approve}
          onCancel={() => {
            setOrder(null);
            onCancel();
          }}
        />
      )}
    </>
  );
}

interface SimulatorApprovalProps {
  order: CreatedOrder;
  working: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

/** Stands in for PayPal's approval window. Portalled to <body>, because the
 * drawer's backdrop blur would otherwise trap a fixed overlay inside it. */
function SimulatorApproval({ order, working, onApprove, onCancel }: SimulatorApprovalProps) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Simulated PayPal approval"
      className="fixed inset-0 z-[60] grid animate-fade place-items-center bg-ink-950/70 p-4 backdrop-blur-sm"
    >
      <div className="glass-strong w-full max-w-sm animate-rise rounded-[26px] p-6">
        <p className="text-[10.5px] uppercase tracking-[0.22em] text-otto">Simulator · no real money</p>
        <h3 className="mt-2 font-display text-3xl text-white">Approve this payment?</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          No PayPal keys are configured, so this window stands in for PayPal&apos;s approval step. Add sandbox keys to
          use the real PayPal button.
        </p>
        <dl className="mt-5 space-y-2 text-sm">
          {[
            ["Merchant", STORE.name],
            ["Order", order.number],
            ["Buyer", "Sara K. (simulated)"],
            ["Amount", formatMoney(order.totalCents)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-white/45">{label}</dt>
              <dd className="text-right text-white">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={working}
            onClick={onCancel}
            className="flex-1 rounded-full bg-white/[0.08] py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={working}
            onClick={onApprove}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-paypal py-3 text-sm font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {working && <Loader2 className="size-4 animate-spin" />}
            Approve payment
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

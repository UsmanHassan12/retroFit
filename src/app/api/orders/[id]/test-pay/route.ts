import { requireUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { payWithTestCard, testCardSchema } from "@/server/services/orders";

/**
 * Body: { cardName, cardNumber, expiry: "MM/YY", cvc }. Only while Stripe isn't configured and
 * test payments are on (dev, DEMO_MODE or TEST_PAYMENTS). 4242 4242 4242 4242 pays the order and
 * creates its projects; 4000 0000 0000 0002 is declined (402). → { url, paid }
 */
export const POST = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  return ok(await payWithTestCard(user, id, await readJson(request, testCardSchema)));
});

import { Link } from "react-router-dom";

/** One short page each, as the launch plan requires. Plain words, no legalese. */

export function Terms() {
  return (
    <main className="wrap page" style={{ maxWidth: 760 }}>
      <h1>Terms</h1>
      <section className="panel" style={{ marginTop: 20 }}>
        <p>
          braidedU is a Cornell student project: a marketplace where students
          find a student braider, see the real price and time up front, and
          request an appointment.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>Accounts</h2>
        <p>
          You need a Cornell email to sign up. One account is either a client
          or a braider. You are responsible for keeping your password safe and
          for what happens under your account.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>Bookings</h2>
        <p>
          A booking is a request until the braider accepts it. Either side can
          cancel; the braider&apos;s page says how late a free cancellation
          runs, and a deposit she asked for may be kept if you cancel past
          that window. After an appointment, the client can leave one review.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>Payments</h2>
        <p>
          Payment goes straight to the braider by Venmo or Zelle. braidedU
          never holds the money and cannot refund it. Venmo and Zelle payments
          cannot be reversed by us if something goes wrong, so only pay a
          braider whose booking you have accepted.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>Photos and listings</h2>
        <p>
          Photos on the site are there only with the person&apos;s say-so. A
          braider can take her page down or remove her photos at any time. Do
          not copy someone&apos;s photos or pretend to be them.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>Be decent</h2>
        <p>
          No harassment, no scams, no fake profiles. Reports are read by the
          site owner, and accounts that break these terms can be removed.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link to="/signup" style={{ fontWeight: 600 }}>Back to sign up</Link>
        </p>
      </section>
    </main>
  );
}

export function Privacy() {
  return (
    <main className="wrap page" style={{ maxWidth: 760 }}>
      <h1>Privacy policy</h1>
      <section className="panel" style={{ marginTop: 20 }}>
        <p>
          braidedU collects only what it needs to run the marketplace, and
          nothing you put here is sold or shared for advertising.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>What we keep</h2>
        <p>
          Your Cornell email and name, your braider or client profile, your
          listings, bookings, messages and reviews. Photos you upload are
          stored by our photo host (Cloudinary) and shown only where you put
          them.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>Who sees it</h2>
        <p>
          Your public page shows your name, photo, styles and prices. Your
          address and payment handles are shown to a client only after you
          accept their booking. Messages are visible only to the two people
          in them. Reports are read by the site owner.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>Emails</h2>
        <p>
          We email you to confirm your account, when a booking changes, when
          a new message arrives, and the day before an appointment. Every
          newsletter email has a one-click unsubscribe, and you can opt out
          any time.
        </p>
        <h2 style={{ fontSize: 22, marginTop: 20 }}>Removing your data</h2>
        <p>
          You can remove every photo you uploaded from your page settings.
          To delete your account and the rest of your data, email the site
          owner from your Cornell address and ask.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link to="/signup" style={{ fontWeight: 600 }}>Back to sign up</Link>
        </p>
      </section>
    </main>
  );
}

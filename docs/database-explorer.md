# Explore the Stays database in MongoDB Atlas

1. Sign in at https://cloud.mongodb.com/ and choose the organisation/project containing the application cluster.
2. Open **Database → Data Explorer**, or select **Browse Collections** on the cluster card when that label is shown.
3. Select the cluster and expand the **test** database. This is the existing application database; the Stays rebrand did not rename or migrate it.
4. Select a collection and open its **Documents** tab.
5. Enter a query in **Filter** and click **Find/Apply**. Use `{}` to see every document, and refresh after changing something through the application.

| Collection | Contents |
| --- | --- |
| `users` | Account names, email addresses, password hashes and verification/closure status |
| `listings` | Property details, owner references, prices, photos and archival status |
| `bookings` | Guest/host references, stay dates, totals and payment/cancellation status |
| `bookingnights` | Occupied dates used to prevent double bookings |
| `reviews` | Listing/author references, ratings and comments |
| `paymentattempts` | Razorpay orders and reservation verification progress |
| `emails` | Notification contents, retry counts and delivery state |
| `images` | Uploaded cover images and content types |
| `sessions` | Server-side login sessions |

Useful examples:

```javascript
// listings: active properties
{ archived: false }

// bookings: confirmed reservations
{ status: "confirmed" }

// bookings: paid Razorpay sandbox reservations
{ payment: "test-paid" }

// emails: messages awaiting delivery
{ state: "pending" }

// emails: messages that exhausted their retries
{ state: "failed" }

// users: verified email addresses
{ emailVerifiedAt: { $exists: true } }
```

Values such as `owner`, `guest`, `host`, `listing` and `author` are ObjectId references. Copy an ID and filter the related collection with `{ _id: ObjectId("PASTE_THE_24_CHARACTER_ID") }` to follow that relationship. Password hashes cannot be used to recover the original password.

Official references: [view collections](https://www.mongodb.com/docs/atlas/atlas-ui/collections/) and [query filters](https://www.mongodb.com/docs/atlas/atlas-ui/query/filter/).

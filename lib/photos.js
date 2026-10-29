const photos = {
  Home: '/images/stays/home.jpg',
  Apartment: '/images/stays/apartment.jpg',
  Cabin: '/images/stays/cabin.jpg',
  Villa: '/images/stays/villa.jpg',
  Hotel: '/images/stays/hotel.jpg',
};
function photoFor(listing) {
  const image = listing.image || '';
  return !image || image.includes('placehold.co') || image === photos.Home
    ? photos[listing.category] || photos.Home
    : image;
}
module.exports = { photos, photoFor };

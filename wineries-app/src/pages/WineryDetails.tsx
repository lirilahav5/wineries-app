import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';

interface WineryDetails {
  id: number;
  name: string;
  region: string;
  description: string;
  imageUrl: string;
  address: string;
  phone: string;
  website: string;
  openingHours: string;
  coordinates: [number, number];
  wines: {
    name: string;
    type: string;
    description: string;
    price: number;
  }[];
}

const icon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const WineryDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [winery, setWinery] = useState<WineryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Replace with actual Supabase query
    const fetchWineryDetails = async () => {
      try {
        // Temporary mock data
        const mockWinery: WineryDetails = {
          id: 1,
          name: "Golan Heights Winery",
          region: "Golan Heights",
          description: "One of Israel's leading wineries, known for its premium wines.",
          imageUrl: "https://via.placeholder.com/800x400",
          address: "Katzrin Industrial Zone, Golan Heights",
          phone: "+972-4-696-8400",
          website: "https://www.golanwines.co.il",
          openingHours: "Sun-Thu: 9:00-17:00, Fri: 9:00-14:00",
          coordinates: [32.9901, 35.6897],
          wines: [
            {
              name: "Yarden Cabernet Sauvignon",
              type: "Red",
              description: "Full-bodied red wine with rich fruit flavors",
              price: 120
            },
            {
              name: "Gamla Chardonnay",
              type: "White",
              description: "Crisp white wine with citrus notes",
              price: 90
            }
          ]
        };
        setWinery(mockWinery);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch winery details');
        setLoading(false);
      }
    };

    fetchWineryDetails();
  }, [id]);

  if (loading) return <div className="text-center">Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!winery) return <div className="alert alert-warning">Winery not found</div>;

  return (
    <div className="winery-details">
      <div className="row">
        <div className="col-md-8">
          <img 
            src={winery.imageUrl} 
            alt={winery.name} 
            className="img-fluid rounded mb-4"
          />
          <h1>{winery.name}</h1>
          <h4 className="text-muted mb-4">{winery.region}</h4>
          <p className="lead">{winery.description}</p>
          
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">Contact Information</h5>
              <p><strong>Address:</strong> {winery.address}</p>
              <p><strong>Phone:</strong> {winery.phone}</p>
              <p><strong>Website:</strong> <a href={winery.website} target="_blank" rel="noopener noreferrer">{winery.website}</a></p>
              <p><strong>Opening Hours:</strong> {winery.openingHours}</p>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">Our Wines</h5>
              <div className="row">
                {winery.wines.map((wine, index) => (
                  <div key={index} className="col-md-6 mb-3">
                    <div className="card h-100">
                      <div className="card-body">
                        <h6 className="card-title">{wine.name}</h6>
                        <p className="card-text text-muted">{wine.type}</p>
                        <p className="card-text">{wine.description}</p>
                        <p className="card-text"><strong>Price:</strong> ₪{wine.price}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Location</h5>
              <div style={{ height: '300px' }}>
                <MapContainer 
                  center={winery.coordinates} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <Marker position={winery.coordinates} icon={icon}>
                    <Popup>
                      {winery.name}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WineryDetails; 
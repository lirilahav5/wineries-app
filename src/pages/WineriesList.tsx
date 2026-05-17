import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Winery {
  id: number;
  name: string;
  region: string;
  description: string;
  imageUrl: string;
}

const WineriesList = () => {
  const [wineries, setWineries] = useState<Winery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Replace with actual Supabase query
    const fetchWineries = async () => {
      try {
        // Temporary mock data
        const mockWineries: Winery[] = [
          {
            id: 1,
            name: "Golan Heights Winery",
            region: "Golan Heights",
            description: "One of Israel's leading wineries, known for its premium wines.",
            imageUrl: "https://via.placeholder.com/150"
          },
          {
            id: 2,
            name: "Carmel Winery",
            region: "Zichron Yaakov",
            description: "Israel's largest winery, producing a wide range of wines.",
            imageUrl: "https://via.placeholder.com/150"
          }
        ];
        setWineries(mockWineries);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch wineries');
        setLoading(false);
      }
    };

    fetchWineries();
  }, []);

  if (loading) return <div className="text-center">Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="wineries-list">
      <h1 className="mb-4">Israeli Wineries</h1>
      <div className="row">
        {wineries.map((winery) => (
          <div key={winery.id} className="col-md-6 mb-4">
            <div className="card h-100">
              <img 
                src={winery.imageUrl} 
                className="card-img-top" 
                alt={winery.name}
                style={{ height: '200px', objectFit: 'cover' }}
              />
              <div className="card-body">
                <h5 className="card-title">{winery.name}</h5>
                <h6 className="card-subtitle mb-2 text-muted">{winery.region}</h6>
                <p className="card-text">{winery.description}</p>
                <Link to={`/winery/${winery.id}`} className="btn btn-primary">
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WineriesList; 
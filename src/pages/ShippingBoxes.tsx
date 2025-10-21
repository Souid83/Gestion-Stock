import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ShippingBox {
  id: string;
  name: string;
  width_cm: number;
  height_cm: number;
  depth_cm: number;
}

export const ShippingBoxes: React.FC = () => {
  const [boxes, setBoxes] = useState<ShippingBox[]>([]);
  const [newBox, setNewBox] = useState({
    name: '',
    width_cm: '',
    height_cm: '',
    depth_cm: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoxes = async () => {
    try {
      const { data, error } = await supabase
        .from('shipping_boxes')
        .select('*')
        .order('name');

      if (error) throw error;
      setBoxes(data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoxes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('shipping_boxes')
        .insert([{
          name: newBox.name,
          width_cm: parseFloat(newBox.width_cm),
          height_cm: parseFloat(newBox.height_cm),
          depth_cm: parseFloat(newBox.depth_cm)
        }]);

      if (error) throw error;
      
      setNewBox({
        name: '',
        width_cm: '',
        height_cm: '',
        depth_cm: ''
      });
      
      fetchBoxes();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div className="text-red-600">Erreur: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Formats de colis d'expédition</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form for adding new box format */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Ajouter un nouveau format</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du format
              </label>
              <input
                type="text"
                value={newBox.name}
                onChange={(e) => setNewBox(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Largeur (cm)
                </label>
                <input
                  type="number"
                  value={newBox.width_cm}
                  onChange={(e) => setNewBox(prev => ({ ...prev, width_cm: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hauteur (cm)
                </label>
                <input
                  type="number"
                  value={newBox.height_cm}
                  onChange={(e) => setNewBox(prev => ({ ...prev, height_cm: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profondeur (cm)
                </label>
                <input
                  type="number"
                  value={newBox.depth_cm}
                  onChange={(e) => setNewBox(prev => ({ ...prev, depth_cm: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  step="0.1"
                />
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Ajouter le format
            </button>
          </form>
        </div>

        {/* List of existing box formats */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Formats existants</h2>
          <div className="space-y-4">
            {boxes.map(box => (
              <div
                key={box.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <h3 className="font-medium text-lg">{box.name}</h3>
                <div className="mt-2 grid grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Largeur:</span> {box.width_cm} cm
                  </div>
                  <div>
                    <span className="font-medium">Hauteur:</span> {box.height_cm} cm
                  </div>
                  <div>
                    <span className="font-medium">Profondeur:</span> {box.depth_cm} cm
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
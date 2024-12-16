import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { API_CONFIG, createApiUrl, getAuthHeader } from "../../config/api";
import SuccessModal from "../../admin/components/SuccessModal";
import "leaflet/dist/leaflet.css";

// Import leaflet icons
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Komponen untuk mengatur center peta
const ChangeMapCenter = ({ center }) => {
    const map = useMap();
    map.setView(center);
    return null;
};

// Komponen untuk menangani klik pada peta
const LocationPicker = ({ position, setPosition }) => {
    const map = useMap();

    useEffect(() => {
        map.on("click", (e) => {
            setPosition([e.latlng.lat, e.latlng.lng]);
        });
    }, [map]);

    return position ? <Marker position={position} /> : null;
};

const EditStore = () => {
    const { store_id } = useParams();
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({
        type: 'success',
        message: '',
        autoClose: true
    });
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [store, setStore] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        num: "",
        loc: "",
        image: null
    });
    const [formErrors, setFormErrors] = useState({});
    const [mapCenter, setMapCenter] = useState([-6.2, 106.816666]);
    const [markerPosition, setMarkerPosition] = useState([-6.2, 106.816666]);
    const [previewImage, setPreviewImage] = useState(null);

    // Fetch store data
    useEffect(() => {
        const fetchStore = async () => {
            try {
                const response = await fetch(
                    createApiUrl(API_CONFIG.ENDPOINTS.STORES.DETAIL, { id: store_id }),
                    {
                        method: "GET",
                        headers: getAuthHeader(),
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                setStore(data.data);

                // Extract coordinates from loc string
                const locMatch = data.data.loc?.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
                if (locMatch) {
                    const [lat, lng] = [parseFloat(locMatch[1]), parseFloat(locMatch[2])];
                    setMapCenter([lat, lng]);
                    setMarkerPosition([lat, lng]);
                }

                // Set form data
                const { id, products, ...storeData } = data.data;
                setFormData(storeData);
                
                // Set preview image if exists
                if (data.data.image) {
                    setPreviewImage(`${API_CONFIG.BASE_URL}/${data.data.image}`);
                }

            } catch (error) {
                console.error("Failed to fetch store:", error);
                setModalConfig({
                    type: 'error',
                    message: 'Gagal mengambil data toko',
                    autoClose: false
                });
                setShowModal(true);
            } finally {
                setInitialLoading(false);
            }
        };

        fetchStore();
    }, [store_id]);

    useEffect(() => {
        setFormData((prev) => ({
            ...prev,
            loc: `(${markerPosition[0]}, ${markerPosition[1]})`,
        }));
    }, [markerPosition]);

    const validateForm = () => {
        const errors = {};
        
        if (!formData.name.trim()) {
            errors.name = "Nama toko wajib diisi";
        }

        if (!formData.address.trim()) {
            errors.address = "Alamat wajib diisi";
        }

        if (!formData.num.trim()) {
            errors.num = "Nomor telepon wajib diisi";
        } else if (!/^[0-9]{10,13}$/.test(formData.num)) {
            errors.num = "Nomor telepon tidak valid (10-13 digit)";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value, type, files } = e.target;
        
        if (type === "file") {
            if (files[0]) {
                setFormData(prev => ({
                    ...prev,
                    image: files[0]
                }));

                // Create preview URL
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviewImage(reader.result);
                };
                reader.readAsDataURL(files[0]);
            }
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }

        // Clear error when user types
        setFormErrors(prev => ({
            ...prev,
            [name]: ""
        }));
    };

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const newPosition = [latitude, longitude];
                    setMapCenter(newPosition);
                    setMarkerPosition(newPosition);
                    setFormData((prev) => ({
                        ...prev,
                        loc: `(${latitude}, ${longitude})`,
                    }));
                },
                (error) => {
                    console.error("Error getting location:", error);
                    setModalConfig({
                        type: 'error',
                        message: 'Tidak dapat mendapatkan lokasi. Pastikan GPS aktif.',
                        autoClose: false
                    });
                    setShowModal(true);
                }
            );
        } else {
            setModalConfig({
                type: 'error',
                message: 'Browser Anda tidak mendukung geolokasi',
                autoClose: false
            });
            setShowModal(true);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            setModalConfig({
                type: 'error',
                message: 'Mohon periksa kembali form anda',
                autoClose: false
            });
            setShowModal(true);
            return;
        }

        setIsLoading(true);

        const uploadData = new FormData();
        Object.keys(formData).forEach((key) => {
            if (key === 'image' && !formData[key]) {
                return; // Skip if no new image
            }
            uploadData.append(key, formData[key]);
        });

        try {
            const response = await fetch(
                createApiUrl(API_CONFIG.ENDPOINTS.STORES.DETAIL, { id: store_id }),
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("jwt")}`,
                    },
                    body: uploadData,
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Gagal mengupdate toko");
            }

            setModalConfig({
                type: 'success',
                message: 'Toko berhasil diupdate! Anda akan dialihkan...',
                autoClose: true
            });
            setShowModal(true);

            setTimeout(() => {
                navigate("/stores");
            }, 3000);

        } catch (error) {
            console.error("Error:", error.message);
            setModalConfig({
                type: 'error',
                message: `Error: ${error.message}`,
                autoClose: false
            });
            setShowModal(true);
        } finally {
            setIsLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data toko...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Header Section */}
            <div className="p-4 bg-white block sm:flex items-center justify-between border-b border-gray-200 lg:mt-1.5 dark:bg-gray-800 dark:border-gray-700">
                <div className="w-full mb-1">
                    <div className="mb-4">
                        <nav className="flex mb-5" aria-label="Breadcrumb">
                            <ol className="inline-flex items-center space-x-1 md:space-x-2">
                                <li className="inline-flex items-center">
                                    <Link
                                        to="/stores"
                                        className="text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-white"
                                    >
                                        Toko
                                    </Link>
                                </li>
                                <li>
                                    <div className="flex items-center">
                                        <svg
                                            className="w-6 h-6 text-gray-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                                clipRule="evenodd"
                                            ></path>
                                        </svg>
                                        <span className="text-gray-400 ml-1 md:ml-2 dark:text-gray-500">
                                            Edit Toko
                                        </span>
                                    </div>
                                </li>
                            </ol>
                        </nav>
                        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl dark:text-white">
                            Edit Toko
                        </h1>
                    </div>
                </div>
            </div>

            {/* Form Section */}
            <div className="p-4">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Nama Toko */}
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                                Nama Toko
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className={`bg-gray-50 border ${
                                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                                } text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500`}
                                disabled={isLoading}
                            />
                            {formErrors.name && (
                                <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
                            )}
                        </div>

                        {/* Nomor Telepon */}
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                                Nomor Telepon
                            </label>
                            <input
                                type="text"
                                name="num"
                                value={formData.num}
                                onChange={handleChange}
                                className={`bg-gray-50 border ${
                                    formErrors.num ? 'border-red-500' : 'border-gray-300'
                                } text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500`}
                                disabled={isLoading}
                            />
                            {formErrors.num && (
                                <p className="mt-1 text-sm text-red-500">{formErrors.num}</p>
                            )}
                        </div>

                        {/* Alamat */}
                        <div className="lg:col-span-2">
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                                Alamat
                            </label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows="4"
                                className={`bg-gray-50 border ${
                                    formErrors.address ? 'border-red-500' : 'border-gray-300'
                                } text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500`}
                                disabled={isLoading}
                            ></textarea>
                            {formErrors.address && (
                                <p className="mt-1 text-sm text-red-500">{formErrors.address}</p>
                            )}
                        </div>

                        {/* Map Location */}
                        <div className="lg:col-span-2">
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                                Lokasi Toko
                            </label>
                            <div style={{ height: "400px", width: "100%" }}>
                                <MapContainer
                                    center={mapCenter}
                                    zoom={13}
                                    style={{ height: "100%", width: "100%" }}
                                >
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    />
                                    <ChangeMapCenter center={mapCenter} />
                                    <LocationPicker
                                        position={markerPosition}
                                        setPosition={setMarkerPosition}
                                    />
                                </MapContainer>
                            </div>
                            <div className="mt-2 text-sm text-gray-500">
                                Koordinat: {formData.loc}
                            </div>
                            <button
                                type="button"
                                onClick={getCurrentLocation}
                                className="mt-4 w-full text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800"
                                disabled={isLoading}
                            >
                                Gunakan Lokasi Saat Ini
                            </button>
                        </div>

                        {/* Image Upload */}
                        <div className="lg:col-span-2">
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                                Foto Nota
                            </label>
                            {previewImage && (
                                <div className="mb-4">
                                    <img
                                        src={previewImage}
                                        alt="Preview"
                                        className="max-h-48 rounded-lg"
                                    />
                                </div>
                            )}
                            <input
                                type="file"
                                name="image"
                                onChange={handleChange}
                                accept="image/*"
                                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                                disabled={isLoading}
                            />
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                                Biarkan kosong jika tidak ingin mengubah foto
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Menyimpan...
                                </div>
                            ) : (
                                "Simpan Perubahan"
                            )}
                        </button>
                        <Link
                            to="/stores"
                            className="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-gray-700"
                        >
                            Batal
                        </Link>
                    </div>
                </form>
            </div>

            {/* Success/Error Modal */}
            <SuccessModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    if (modalConfig.type === 'success') {
                        navigate("/stores");
                    }
                }}
                message={modalConfig.message}
                type={modalConfig.type}
                autoClose={modalConfig.autoClose}
            />
        </>
    );
};

export default EditStore;

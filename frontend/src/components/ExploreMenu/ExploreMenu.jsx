import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./ExploreMenu.css";
import { StoreContext } from "../../context/StoreContext";
import { resolveImageSrc } from "../../utils/resolveImage";

const normalizeCategory = (item, index) => {
  const id = item?.id || item?._id || `category-${index}`;
  const name =
    item?.name || item?.title || item?.category_name || item?.categoryName || "Uncategorized";
  const image =
    item?.image || item?.image_url || item?.imageUrl || item?.thumbnail || "";

  return {
    id,
    name: String(name),
    image: String(image || ""),
    description: item?.description || "",
    isSystem: Boolean(item?.isSystem),
    slug: String(item?.slug || "").toLowerCase(),
  };
};

const ExploreMenu = ({ category, setCategory, topSlot = null }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const store = useContext(StoreContext);

  const apiUrl = useMemo(
    () => store?.url || import.meta.env.VITE_API_URL || "http://localhost:4000",
    [store?.url]
  );

  useEffect(() => {
    let mounted = true;

    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${apiUrl}/api/category/list`).catch(() =>
          axios.get(`${apiUrl}/api/categories`)
        );

        const data = response?.data?.data;
        const rawList = Array.isArray(data)
          ? data
          : Array.isArray(data?.categories)
            ? data.categories
            : [];

        const normalized = rawList
          .map((item, index) => normalizeCategory(item, index))
          .filter((item) => {
            const isFallbackByName = item.name.toLowerCase() === "uncategorized";
            const isFallbackBySlug = item.slug === "uncategorized";
            return !item.isSystem && !isFallbackByName && !isFallbackBySlug;
          });

        if (mounted) {
          setCategories(normalized);
        }
      } catch (error) {
        if (mounted) {
          setCategories([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchCategories();

    return () => {
      mounted = false;
    };
  }, [apiUrl]);

  const buildImageSrc = (imagePath) => {
    const resolved = resolveImageSrc(imagePath, apiUrl);
    return resolved || null;
  };

  return (
    <div className="explore-menu" id="explore-menu">
      <h1>Khám Phá Hương Vị Cà Phê & Ẩm Thực</h1>
      <p className="explore-menu-text">
        Thưởng thức cà phê chất lượng cùng các món ăn ngon được chế biến tỉ mỉ, mang đến trải nghiệm thư giãn và trọn vẹn.
      </p>

      {topSlot}

      {loading ? (
        <p className="explore-menu-state">Đang tải danh mục...</p>
      ) : categories.length === 0 ? (
        <p className="explore-menu-state">Chưa có danh mục</p>
      ) : (
        <div className="explore-menu-list category-list">
          {categories.map((item) => {
            const imageSrc = buildImageSrc(item.image);

            return (
              <div
                key={item.id}
                onClick={() =>
                  setCategory((prev) => (prev === item.name ? "All" : item.name))
                }
                className="explore-menu-list-item category-item"
              >
                {imageSrc ? (
                  <img
                    className={category === item.name ? "active" : ""}
                    src={imageSrc}
                    alt={item.name}
                  />
                ) : (
                  <div
                    className={`explore-menu-placeholder ${category === item.name ? "active" : ""}`}
                  >
                    {item.name?.charAt(0)?.toUpperCase() || "C"}
                  </div>
                )}
                <p>{item.name}</p>
              </div>
            );
          })}
        </div>
      )}

      <hr />
    </div>
  );
};

export default ExploreMenu;


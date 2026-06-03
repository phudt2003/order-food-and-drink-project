import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon } from 'lucide-react'
import { StoreContext } from '../../context/StoreContext'
import FoodItem from '../../components/FoodItem/FoodItem'

const normalize = (value) => String(value || '').trim().toLowerCase()

const Search = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const initialQ = params.get('q') || ''

  const { food_list, cartItems, addToCart, removeFromCart, url } = useContext(StoreContext)
  const [query, setQuery] = useState(initialQ)

  useEffect(() => {
    const next = query.trim()
    if (!next) {
      params.delete('q')
      setParams(params, { replace: true })
      return
    }
    setParams({ q: next }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const results = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    return (Array.isArray(food_list) ? food_list : []).filter((item) => {
      const name = normalize(item?.name)
      const description = normalize(item?.description)
      const category = normalize(item?.category)
      return name.includes(q) || description.includes(q) || category.includes(q)
    })
  }, [food_list, query])

  return (
    <section className='mx-auto w-full max-w-6xl px-4 pb-24 pt-4 md:pb-6'>
      <div className='sticky top-0 z-30 -mx-4 border-b border-gray-200 bg-[var(--bg-body)] px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:px-0'>
        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={() => navigate(-1)}
            className='inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm'
            aria-label='Quay lại'
          >
            <ArrowLeft className='h-5 w-5' aria-hidden='true' />
          </button>

          <div className='flex w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm'>
            <SearchIcon className='h-4 w-4 text-gray-500' aria-hidden='true' />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Tìm cà phê, trà sữa, topping...'
              className='w-full bg-transparent text-sm outline-none'
              autoFocus
            />
          </div>
        </div>

        <p className='mt-2 text-xs text-gray-500'>
          {query.trim()
            ? `Kết quả cho “${query.trim()}” • ${results.length} sản phẩm`
            : 'Nhập từ khóa để tìm sản phẩm.'}
        </p>
      </div>

      <div className='mt-5'>
        {!query.trim() ? (
          <div className='rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 text-sm opacity-80'>
            Gợi ý: thử tìm “cà phê”, “trà sữa”, “bánh”, “topping”...
          </div>
        ) : results.length === 0 ? (
          <div className='rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 text-sm opacity-80'>
            Không tìm thấy sản phẩm phù hợp.
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {results.map((item) => (
              <FoodItem
                key={item._id}
                id={item._id}
                name={item.name}
                description={item.description}
                price={item.price}
                image={item.image}
                itemCount={cartItems?.[item._id] || 0}
                onAdd={addToCart}
                onRemove={removeFromCart}
                url={url}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default Search


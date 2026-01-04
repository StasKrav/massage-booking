// supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://fnigcvidtvouzfpsppmp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaWdjdmlkdHZvdXpmcHNwcG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MTAxNTksImV4cCI6MjA4MzA4NjE1OX0.ljiPPbw9h2NUjWfBx5q7iA1H0pKwVgEiZrYrc01mGWw'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const ADMIN_PHONES = ['+79954801080']

// Создаем bookingAPI
const bookingAPI = {
  async getAllBookings() {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      
      if (error) {
        console.error('Ошибка загрузки записей:', error)
        throw error
      }
      
      const bookingsMap = {}
      if (data) {
          data.forEach(booking => {
              // Убедимся, что дата в правильном формате YYYY-MM-DD
              const formattedDate = booking.date; // должно быть "2024-12-10"
              const time = booking.time.split(':')[0] + ':00'; // нормализуем время
              
              const key = `${formattedDate}_${time}`
              bookingsMap[key] = {
                  date: formattedDate,
                  time: time, // используем нормализованное время
                  name: booking.name,
                  phone: booking.phone,
                  service: booking.service,
                  bookedAt: booking.created_at
              }
          })
      }
      
      console.log('✅ Загружено из Supabase:', Object.keys(bookingsMap).length, 'записей')
      return bookingsMap
      
    } catch (error) {
      console.error('❌ Ошибка Supabase:', error)
      throw error
    }
  },
  
  async createBooking(bookingData) {
    try {
      const { date, time, name, phone, service } = bookingData
      
      // Проверка на дубликат
      const { data: existing } = await supabase
        .from('bookings')
        .select('id')
        .eq('date', date)
        .eq('time', time)
        .maybeSingle()
      
      if (existing) {
        throw new Error('⏰ Это время уже занято')
      }
      
      const { data, error } = await supabase
        .from('bookings')
        .insert([{ date, time, name, phone, service }])
        .select()
        .single()
      
      if (error) {
        console.error('Ошибка создания записи:', error)
        throw error
      }
      
      console.log('✅ Запись создана в Supabase')
      return {
        date: data.date,
        time: data.time,
        name: data.name,
        phone: data.phone,
        service: data.service,
        bookedAt: data.created_at
      }
      
    } catch (error) {
      console.error('❌ Ошибка создания:', error)
      throw error
    }
  },
  
  async deleteBooking(date, time, userPhone) {
    try {
      // Проверяем админские права В КОДЕ
      const isAdmin = ADMIN_PHONES.includes(userPhone);
      
      if (!isAdmin) {
        throw new Error('Только мастер может удалять записи');
      }
      
      // Используем безопасную функцию
      const { error } = await supabase.rpc('admin_delete_booking', {
        p_date: date,
        p_time: time,
        p_admin_phone: userPhone
      });
      
      if (error) {
        if (error.message.includes('Access denied')) {
          throw new Error('Нет прав для удаления');
        }
        throw error;
      }
      
      console.log('✅ Запись удалена админом');
      
    } catch (error) {
      console.error('❌ Ошибка удаления:', error);
      throw error;
    }
  },
  
  subscribeToChanges(callback) {
    const channel = supabase
      .channel('bookings-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings' 
        }, 
        () => {
          console.log('🔄 Обнаружены изменения в БД')
          callback()
        }
      )
      .subscribe()
    
    return {
      unsubscribe: () => {
        supabase.removeChannel(channel)
      }
    }
  }
}

// Делаем bookingAPI доступным глобально
window.bookingAPI = bookingAPI
console.log('✅ Supabase подключен, bookingAPI готов')

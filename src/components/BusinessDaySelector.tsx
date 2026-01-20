import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTodayBusinessDateKey, getBusinessDayCutoff } from '@/lib/limaTime';

interface BusinessDaySelectorProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

export function BusinessDaySelector({ selectedDate, onDateChange }: BusinessDaySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const today = getTodayBusinessDateKey();
  const yesterday = format(subDays(parseISO(today), 1), 'yyyy-MM-dd');
  const cutoff = getBusinessDayCutoff();
  
  const isToday = selectedDate === today;
  const isYesterday = selectedDate === yesterday;
  
  const selectedDateObj = parseISO(selectedDate);
  
  const handlePrevDay = () => {
    const prevDay = subDays(selectedDateObj, 1);
    onDateChange(format(prevDay, 'yyyy-MM-dd'));
  };
  
  const handleNextDay = () => {
    const nextDay = new Date(selectedDateObj.getTime() + 24 * 60 * 60 * 1000);
    const nextDayStr = format(nextDay, 'yyyy-MM-dd');
    // Don't go beyond today
    if (nextDayStr <= today) {
      onDateChange(nextDayStr);
    }
  };
  
  const handleSelectDate = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (dateStr <= today) {
        onDateChange(dateStr);
        setIsOpen(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Quick buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={isToday ? "default" : "outline"}
          size="sm"
          onClick={() => onDateChange(today)}
        >
          Hoy
        </Button>
        <Button
          variant={isYesterday ? "default" : "outline"}
          size="sm"
          onClick={() => onDateChange(yesterday)}
        >
          Ayer
        </Button>
        
        {/* Day navigation */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "min-w-[160px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDateObj, "d 'de' MMMM", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDateObj}
                onSelect={handleSelectDate}
                disabled={(date) => format(date, 'yyyy-MM-dd') > today}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={handleNextDay}
            disabled={selectedDate === today}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Period indicator */}
      <p className="text-xs text-muted-foreground">
        📅 Período: {format(subDays(selectedDateObj, 1), 'd MMM', { locale: es })} {cutoff.hour}:{cutoff.minute.toString().padStart(2, '0')} → {format(selectedDateObj, 'd MMM', { locale: es })} {cutoff.hour}:{cutoff.minute.toString().padStart(2, '0')}
      </p>
    </div>
  );
}
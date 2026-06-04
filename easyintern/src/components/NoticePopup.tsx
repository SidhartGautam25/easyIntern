import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, X } from "lucide-react";

interface NoticePopupProps {
  page: 'home' | 'registration' | 'login';
}

export const NoticePopup = ({ page }: NoticePopupProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (data && data.notice_enabled) {
        const shouldShow = 
          page === 'home' ? data.show_on_home : 
          page === 'registration' ? data.show_on_registration : 
          data.show_on_login;

        if (shouldShow) {
          setSettings(data);
          setIsOpen(true);
        }
      }
    };

    fetchSettings();
  }, [page]);

  if (!settings) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-[90vw] sm:max-w-md border-primary/20 shadow-2xl rounded-3xl overflow-hidden p-0">
        <div className="bg-primary p-6 text-white relative">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Info className="size-6 text-white" />
            </div>
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-black text-white leading-tight">
                {settings.notice_title}
              </DialogTitle>
            </DialogHeader>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-6 bg-white">
          <div className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
            {settings.notice_message}
          </div>
        </div>
        <DialogFooter className="p-4 bg-slate-50 border-t flex sm:flex-row gap-2">
          <Button 
            className="w-full bg-primary hover:bg-primary/90 font-black rounded-xl"
            onClick={() => setIsOpen(false)}
          >
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

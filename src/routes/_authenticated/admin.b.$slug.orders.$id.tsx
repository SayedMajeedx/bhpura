import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OrderDetailsPage() {
  const { id } = useParams({ from: "/_authenticated/admin/b/$slug/orders/$id" });
  const { toast } = useToast();
  
  // 💡 ترتيب الـ Hooks الصحيح في أعلى الدالة لمنع الخطأ 310
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<boolean | null>(null);

  // جلب بيانات الطلب
  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            *,
            product:products(*)
          ),
          customer:customers(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const handleResendEmail = async () => {
    if (!id) return;
    setEmailLoading(true);
    setEmailSuccess(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-order-email", {
        body: { order_id: id },
      });

      if (error) throw error;

      setEmailSuccess(true);
      toast({
        title: "تم إرسال البريد",
        description: "تم إرسال بريد تأكيد الطلب للعميل بنجاح.",
      });
      refetch();
    } catch (err) {
      console.error(err);
      setEmailSuccess(false);
      toast({
        variant: "destructive",
        title: "فشل الإرسال",
        description: "حدث خطأ أثناء محاولة إرسال البريد الإلكتروني.",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">جاري تحميل تفاصيل الطلب...</div>;
  if (error || !order) return <div className="p-8 text-center text-red-500">حدث خطأ أثناء جلب الطلب أو الطلب غير موجود.</div>;

  return (
    <div className="container mx-auto p-6 space-y-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">تفاصيل الطلب #{order.order_number || order.id.slice(0,8)}</h1>
          <p className="text-sm text-gray-500">تاريخ الطلب: {new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
        </div>
        
        {/* زر إعادة إرسال الإيميل الاحترافي */}
        <Button 
          onClick={handleResendEmail} 
          disabled={emailLoading}
          variant={emailSuccess ? "outline" : "default"}
          className="flex items-center gap-2"
        >
          {emailLoading ? (
            <span className="animate-spin">⏳</span>
          ) : emailSuccess === true ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : emailSuccess === false ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {emailSuccess ? "تم الإرسال" : "إعادة إرسال بريد التأكيد"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">المنتجات</h2>
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium text-gray-800">{item.product?.name_ar || item.product?.name || 'عباية'}</p>
                <p className="text-sm text-gray-500">الكمية: {item.quantity} × {item.unit_price} د.ب</p>
              </div>
              <p className="font-bold">{item.quantity * item.unit_price} د.ب</p>
            </div>
          ))}
          <div className="text-left pt-4 border-t">
            <p className="text-gray-600">المجموع الكلي:</p>
            <p className="text-2xl font-bold text-primary">{order.total_amount} د.ب</p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h2 className="text-lg font-semibold border-b pb-2">بيانات العميل</h2>
          <p><span className="text-gray-500">الاسم:</span> {order.customer?.full_name || 'عميل زائر'}</p>
          <p><span className="text-gray-500">الهاتف:</span> {order.customer?.phone || order.shipping_address?.phone || 'غير مسجل'}</p>
          <p><span className="text-gray-500">البريد:</span> {order.customer?.email || 'لا يوجد بريد'}</p>
          <p><span className="text-gray-500">حالة إرسال الإيميل:</span> <span className="font-mono text-sm px-2 py-0.5 bg-gray-200 rounded">{order.confirmation_email_status || 'pending'}</span></p>
        </div>
      </div>
    </div>
  );
}
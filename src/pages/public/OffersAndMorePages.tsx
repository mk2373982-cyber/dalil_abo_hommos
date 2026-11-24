export const SuggestPlacePage: React.FC = () => {
  const { activeCategories, createSubmission, showToast } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const initialCategory = useMemo(() => {
    const paramCat = searchParams.get('category');
    if (paramCat && activeCategories.some((c) => c.slug === paramCat)) {
      return paramCat;
    }
    if (searchParams.get('type') === 'hero') return 'heroes';
    return activeCategories[0]?.slug || 'pharmacies';
  }, [searchParams, activeCategories]);

  const [name, setName] = useState('');
  const [categorySlug, setCategorySlug] = useState(initialCategory);
  const [area, setArea] = useState(
    savedProfile.area && ABU_HOMS_AREAS.includes(savedProfile.area) ? savedProfile.area : ABU_HOMS_AREAS[0]
  );
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  // خانات ذكية حسب القسم
  const [specialty, setSpecialty] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [menuText, setMenuText] = useState('');

  // رفع الصور (تتحول تلقائياً إلى WebP وترفع على Cloudinary)
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const [menuImageUrl, setMenuImageUrl] = useState('');
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);

  const [submitterName, setSubmitterName] = useState(savedProfile.name || '');
  const [submitterPhone, setSubmitterPhone] = useState(savedProfile.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const isRestaurant = categorySlug === 'restaurants' || categorySlug.includes('restaurant') || categorySlug.includes('cafe');
  const isMedical = categorySlug === 'medical' || categorySlug.includes('clinic');
  const isHero = categorySlug === 'heroes' || categorySlug.includes('craft');

  const handleMainImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMainImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setImageUrl(url);
      showToast('تم ضغط الصورة ورفعها بنجاح', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'فشل رفع الصورة، حاول مرة أخرى', 'error');
    } finally {
      setUploadingMainImage(false);
      e.target.value = '';
    }
  };

  const handleMenuImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMenuImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setMenuImageUrl(url);
      showToast('تم رفع صورة المينيو بنجاح', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'فشل رفع صورة المينيو، حاول مرة أخرى', 'error');
    } finally {
      setUploadingMenuImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (name.trim().length < 2 || address.trim().length < 2 || submitterName.trim().length < 2) {
      showToast('يرجى استكمال اسم النشاط والعنوان واسمك بشكل صحيح', 'error');
      return;
    }

    if (!imageUrl) {
      showToast('إضافة صورة واضحة للمكان أو اللوجو إلزامية لقبول الطلب', 'error');
      return;
    }

    if (description.trim().length < 10) {
      showToast('يرجى كتابة وصف مختصر وواضح للنشاط (10 أحرف على الأقل)', 'error');
      return;
    }

    if (hours.trim().length < 3) {
      showToast('يرجى كتابة مواعيد العمل', 'error');
      return;
    }

    if ((isMedical || isHero) && specialty.trim().length < 2) {
      showToast(isMedical ? 'يرجى كتابة التخصص الطبي للعيادة' : 'يرجى كتابة المهنة أو التخصص', 'error');
      return;
    }

    if (isRestaurant && !menuImageUrl && menuText.trim().length < 5) {
      showToast('للمطاعم والكافيهات: يرجى رفع صورة المينيو أو كتابة الأصناف والأسعار لقبول الطلب', 'error');
      return;
    }

    const placePhoneCheck = validateEgyptPhone(phone, { allowLandline: true });
    if (!placePhoneCheck.valid) {
      showToast(placePhoneCheck.error || 'رقم هاتف النشاط غير صالح', 'error');
      return;
    }

    let normalizedWhatsapp = '';
    if (whatsapp.trim()) {
      const waCheck = validateEgyptPhone(whatsapp, { allowLandline: false });
      if (!waCheck.valid) {
        showToast(waCheck.error || 'رقم الواتساب غير صالح', 'error');
        return;
      }
      normalizedWhatsapp = waCheck.displayLocal;
    }

    const effectiveSubmitterPhone = (submitterPhone || phone).trim();
    const submitterPhoneCheck = validateEgyptPhone(effectiveSubmitterPhone, { allowLandline: true });
    if (!submitterPhoneCheck.valid) {
      showToast(submitterPhoneCheck.error || 'رقم هاتفك للتأكيد غير صالح', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const sub = await createSubmission({
        type: 'suggest_place',
        title: `اقتراح إضافة: ${name.trim()}`,
        submitterName,
        submitterPhone: submitterPhoneCheck.displayLocal,
        payload: {
          name: name.trim(),
          categorySlug,
          area,
          address: address.trim(),
          phone: placePhoneCheck.displayLocal,
          whatsapp: normalizedWhatsapp,
          hours: hours.trim(),
          description: description.trim(),
          imageUrl,
          ...(specialty.trim() ? { specialty: specialty.trim() } : {}),
          ...(isMedical && consultationFee.trim() ? { consultationFee: Number(consultationFee) || consultationFee.trim() } : {}),
          ...(isRestaurant && deliveryFee.trim() ? { deliveryFee: deliveryFee.trim() } : {}),
          ...(isRestaurant && menuText.trim() ? { menuText: menuText.trim() } : {}),
          ...(isRestaurant && menuImageUrl ? { menuImageUrl } : {}),
        },
      });
      navigate(`/track/${sub.trackingToken}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال الطلب حالياً، يرجى التحقق من البيانات والمحاولة مرة أخرى',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="إضافة نشاط جديد للدليل"
      subtitle="ملف متكامل ومجاني 100% لأهالي وأنشطة أبوحمص"
      backTo="/more"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-[#fef3c7] border border-[#f59e0b]/40 rounded-3xl p-4 text-xs text-[#78350f] leading-relaxed">
            <strong>تنبيه هام لقبول الطلب:</strong> دليل أبوحمص يعرض ملفاً متكاملاً لكل نشاط وليس مجرد اسم ورقم. يرجى استكمال كافة التفاصيل ورفع صورة واضحة للمكان (والمينيو للمطاعم)؛ الطلبات الناقصة قد لا يتم قبولها.
          </div>
        </FadeInUp>

        {/* 1. بيانات النشاط الأساسية */}
        <FadeInUp delay={0.06}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <h2 className="text-sm font-bold text-[#003820]">1. بيانات النشاط الأساسية</h2>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المحل أو العيادة أو الخدمة *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              >
                {ABU_HOMS_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف واضح للنشاط وأهم الخدمات أو المنتجات التي تقدمها *"
              className="w-full p-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
          </div>
        </FadeInUp>

        {/* 2. الصورة الرئيسية للمكان (إلزامي) */}
        <FadeInUp delay={0.08}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#003820]">2. صورة المكان أو اللوجو *</h2>
              <span className="text-[11px] font-semibold text-[#146c43] bg-[#e6f4ec] px-2.5 py-1 rounded-xl">
                إلزامي
              </span>
            </div>

            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-[#e4ece7]">
                <img src={imageUrl} alt="معاينة الصورة" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-3 left-3 min-h-[38px] px-3 rounded-xl bg-[#ba1a1a] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow"
                >
                  <Trash2 size={14} />
                  تغيير الصورة
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 min-h-[120px] rounded-2xl border-2 border-dashed border-[#b0f1c7] bg-[#f7faf8] hover:bg-[#e6f4ec]/50 cursor-pointer transition-colors p-4 text-center">
                {uploadingMainImage ? (
                  <>
                    <Loader2 size={26} className="text-[#003820] animate-spin" />
                    <span className="text-xs font-bold text-[#003820]">جارٍ ضغط الصورة ورفعها...</span>
                  </>
                ) : (
                  <>
                    <Camera size={26} className="text-[#0f5132]" />
                    <span className="text-xs font-bold text-[#003820]">اضغط لاختيار صورة الواجهة أو اللوجو</span>
                    <span className="text-[11px] text-[#707971]">يتم تحويل الصورة تلقائياً لأخف حجم (WebP)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingMainImage}
                  onChange={handleMainImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </FadeInUp>

        {/* تفاصيل إضافية ذكية حسب القسم */}
        {(isRestaurant || isMedical || isHero) && (
          <FadeInUp delay={0.1}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
              <h2 className="text-sm font-bold text-[#003820]">
                {isRestaurant
                  ? '3. المينيو والتوصيل (إلزامي للمطاعم والكافيهات)'
                  : isMedical
                    ? '3. التخصص وسعر الكشف'
                    : '3. تفاصيل المهنة والخدمة'}
              </h2>

              {isMedical && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="التخصص الدقيق (مثال: أطفال، باطنة، أسنان) *"
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                  />
                  <input
                    type="number"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    placeholder="سعر الكشف بالجنيه (اختياري)"
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                  />
                </div>
              )}

              {isHero && (
                <input
                  type="text"
                  required
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="المهنة أو الحرفة (مثال: كهربائي، سباك، نجار) *"
                  className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                />
              )}

              {isRestaurant && (
                <div className="space-y-3.5">
                  {menuImageUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border border-[#e4ece7]">
                      <img src={menuImageUrl} alt="صورة المينيو" className="w-full h-44 object-cover" />
                      <button
                        type="button"
                        onClick={() => setMenuImageUrl('')}
                        className="absolute top-3 left-3 min-h-[36px] px-3 rounded-xl bg-[#ba1a1a] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow"
                      >
                        <Trash2 size={14} />
                        حذف صورة المينيو
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 min-h-[54px] rounded-2xl border border-dashed border-[#0f5132]/40 bg-[#f7faf8] hover:bg-[#e6f4ec]/50 cursor-pointer px-4 text-xs font-bold text-[#003820]">
                      {uploadingMenuImage ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>جارٍ رفع صورة المينيو...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          <span>رفع صورة المينيو (أو اكتب الأصناف بالأسفل)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingMenuImage}
                        onChange={handleMenuImageChange}
                        className="hidden"
                      />
                    </label>
                  )}

                  <textarea
                    rows={4}
                    value={menuText}
                    onChange={(e) => setMenuText(e.target.value)}
                    placeholder={'اكتب أهم الأصناف والأسعار (صنف في كل سطر)، مثال:\nكشري كبير - 45\nطاجن لحمة - 70'}
                    className="w-full p-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                  />

                  <input
                    type="text"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="سعر التوصيل (مثال: 15 ج داخل البندر، 30 ج للقرى)"
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                  />
                </div>
              )}
            </div>
          </FadeInUp>
        )}

        {/* العنوان وأرقام التواصل */}
        <FadeInUp delay={0.12}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <h2 className="text-sm font-bold text-[#003820]">العنوان وأرقام التواصل والمواعيد</h2>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="العنوان الدقيق أو أقرب علامة مميزة *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف للاتصال *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
              <input
                type="tel"
                dir="ltr"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="رقم الواتساب (اختياري)"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>
            <input
              type="text"
              required
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="مواعيد العمل (مثال: يومياً من 9 صباحاً حتى 11 مساءً) *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
          </div>
        </FadeInUp>

        {/* بيانات المتابعة */}
        <FadeInUp delay={0.14}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <h2 className="text-sm font-bold text-[#003820]">بياناتك للمتابعة (بدون إنشاء حساب)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="اسمك الكريم *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={submitterPhone}
                onChange={(e) => setSubmitterPhone(e.target.value)}
                placeholder="رقم هاتفك للتأكيد *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.18}>
          <button
            type="submit"
            disabled={submitting || uploadingMainImage || uploadingMenuImage}
            className="w-full min-h-[52px] bg-[#003820] text-white font-bold text-sm rounded-2xl shadow-civic-2 active:scale-95 transition-transform disabled:opacity-60"
          >
            {submitting ? 'جارٍ إرسال الطلب...' : 'إرسال الطلب المكتمل للاعتماد مجاناً'}
          </button>
        </FadeInUp>
      </form>
    </StackLayout>
  );
};
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "job-photos";

export const photoKeys = {
  list: (appointmentId: string) => ["appointment-photos", appointmentId] as const,
};

export function publicPhotoUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export function useAppointmentPhotos(appointmentId: string) {
  return useQuery({
    queryKey: photoKeys.list(appointmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_photos")
        .select("*")
        .eq("appointment_id", appointmentId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadPhoto(appointmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, accountId }: { file: File; accountId: string }) => {
      const extension = file.name.split(".").pop() ?? "jpg";
      const path = `${appointmentId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from("appointment_photos")
        .insert({ appointment_id: appointmentId, account_id: accountId, storage_path: path });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: photoKeys.list(appointmentId) });
    },
  });
}

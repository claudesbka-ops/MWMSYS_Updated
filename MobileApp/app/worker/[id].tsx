import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();

  const workerId = (id ?? "").toString();

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [personal, setPersonal] = useState<any>(null);
  const [permit, setPermit] = useState<any>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [contactCountryCode, setContactCountryCode] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [nationality, setNationality] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportIssue, setPassportIssue] = useState("");
  const [passportExpire, setPassportExpire] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [highestEducation, setHighestEducation] = useState("");
  const [motherName, setMotherName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [permitExpire, setPermitExpire] = useState("");

  const appRole = (session.claims?.appRole ?? "").toString();
  const canEdit = appRole === "admin" || appRole === "agency" || appRole === "employer" || appRole === "worker";

  const load = async () => {
    if (!workerId) return;
    setLoading(true);
    try {
      const res = await api.get<any>(`/Api/Workers/${encodeURIComponent(workerId)}`);
      const p = res?.personal ?? null;
      const perm = res?.permit ?? null;
      setPersonal(p);
      setPermit(perm);
      setName(String(p?.Name ?? ""));
      setEmail(String(p?.Email_Id ?? ""));
      setContact(String(p?.Contact_Number ?? ""));
      setContactCountryCode(String(p?.Contact_Number_Country_Code ?? ""));
      setAddress(String(p?.Address ?? ""));
      setDistrict(String(p?.District ?? ""));
      setState(p?.State != null ? String(p.State) : "");
      setCity(p?.City != null ? String(p.City) : "");
      setNationality(p?.Nationality != null ? String(p.Nationality) : "");
      setPassportNumber(String(p?.Passport_Number ?? ""));
      setPassportIssue(p?.Passport_Issue_Date ? String(p.Passport_Issue_Date).slice(0, 10) : "");
      setPassportExpire(p?.Passport_Expire_Date ? String(p.Passport_Expire_Date).slice(0, 10) : "");
      setGender(String(p?.Gender ?? ""));
      setDateOfBirth(p?.Date_Of_Birth ? String(p.Date_Of_Birth).slice(0, 10) : "");
      setMaritalStatus(p?.Marital_Status != null ? String(p.Marital_Status) : "");
      setHighestEducation(String(p?.Highest_Education ?? ""));
      setMotherName(String(p?.Mother_Name ?? ""));
      setFatherName(String(p?.Father_Name ?? ""));
      setPermitExpire(perm?.Permit_Expire_Date ? String(perm.Permit_Expire_Date).slice(0, 10) : "");
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load worker");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!workerId) return;
    setBusy(true);
    try {
      await api.put(`/Api/Workers/${encodeURIComponent(workerId)}`, {
        name,
        emailId: email,
        contactNumber: contact,
        contactCountryCode: contactCountryCode.trim() || undefined,
        address,
        district: district.trim() || undefined,
        state: state.trim() ? Number(state) : undefined,
        city: city.trim() ? Number(city) : undefined,
        nationality: nationality.trim() ? Number(nationality) : undefined,
        passportNumber: passportNumber.trim() || undefined,
        passportIssueDate: passportIssue.trim() || undefined,
        passportExpireDate: passportExpire.trim() || undefined,
        gender: gender.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        maritalStatus: maritalStatus.trim() ? Number(maritalStatus) : undefined,
        highestEducation: highestEducation.trim() || undefined,
        motherName: motherName.trim() || undefined,
        fatherName: fatherName.trim() || undefined,
        permitExpireDate: permitExpire.trim() || undefined,
      } as any);
      Alert.alert("Saved", "Worker updated");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to update worker");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [workerId]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Worker</Text>
      <Text style={styles.subtitle}>{workerId}</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Contact</Text>
          <TextInput value={contact} onChangeText={setContact} style={styles.input} editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Contact Country Code</Text>
          <TextInput
            value={contactCountryCode}
            onChangeText={setContactCountryCode}
            style={styles.input}
            autoCapitalize="none"
            editable={canEdit && !busy}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Address</Text>
          <TextInput value={address} onChangeText={setAddress} style={[styles.input, styles.multiline]} multiline editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>District</Text>
          <TextInput value={district} onChangeText={setDistrict} style={styles.input} editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>State (code)</Text>
          <TextInput value={state} onChangeText={setState} style={styles.input} keyboardType="numeric" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>City (code)</Text>
          <TextInput value={city} onChangeText={setCity} style={styles.input} keyboardType="numeric" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Nationality (code)</Text>
          <TextInput value={nationality} onChangeText={setNationality} style={styles.input} keyboardType="numeric" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Passport Number</Text>
          <TextInput
            value={passportNumber}
            onChangeText={setPassportNumber}
            style={styles.input}
            autoCapitalize="characters"
            editable={canEdit && !busy}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Passport Issue Date (YYYY-MM-DD)</Text>
          <TextInput value={passportIssue} onChangeText={setPassportIssue} style={styles.input} autoCapitalize="none" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Passport Expiry (YYYY-MM-DD)</Text>
          <TextInput value={passportExpire} onChangeText={setPassportExpire} style={styles.input} autoCapitalize="none" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Permit/Visa Expiry (YYYY-MM-DD)</Text>
          <TextInput value={permitExpire} onChangeText={setPermitExpire} style={styles.input} autoCapitalize="none" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Gender</Text>
          <TextInput value={gender} onChangeText={setGender} style={styles.input} autoCapitalize="words" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput value={dateOfBirth} onChangeText={setDateOfBirth} style={styles.input} autoCapitalize="none" editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Marital Status (code)</Text>
          <TextInput
            value={maritalStatus}
            onChangeText={setMaritalStatus}
            style={styles.input}
            keyboardType="numeric"
            editable={canEdit && !busy}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Highest Education</Text>
          <TextInput value={highestEducation} onChangeText={setHighestEducation} style={styles.input} editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Mother Name</Text>
          <TextInput value={motherName} onChangeText={setMotherName} style={styles.input} editable={canEdit && !busy} />

          <Text style={[styles.label, { marginTop: 12 }]}>Father Name</Text>
          <TextInput value={fatherName} onChangeText={setFatherName} style={styles.input} editable={canEdit && !busy} />

          {canEdit ? (
            <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={save} disabled={busy}>
              <Text style={styles.primaryBtnText}>{busy ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
          ) : null}

          {personal ? <Text style={styles.meta}>Passport: {String(personal?.Passport_Number ?? "—")}</Text> : null}
          {permit ? <Text style={styles.meta}>Permit/Visa Expiry: {permit?.Permit_Expire_Date ? String(permit.Permit_Expire_Date).slice(0, 10) : "—"}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  backText: { fontWeight: "800", opacity: 0.8 },
  title: { marginTop: 12, fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  loadingWrap: { padding: 18 },
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  label: { fontSize: 12, fontWeight: "700", opacity: 0.8 },
  input: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", paddingHorizontal: 12, marginTop: 8, color: "inherit" as any },
  multiline: { height: 90, paddingTop: 10 },
  primaryBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
  meta: { marginTop: 12, fontSize: 12, opacity: 0.7 },
});

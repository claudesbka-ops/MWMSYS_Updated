import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen, Card, PrimaryButton, SectionTitle } from "@/components/ui";

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

  const inputProps = { editable: canEdit && !busy, style: styles.input, placeholderTextColor: "rgba(15,23,42,0.4)" as any };

  return (
    <Screen title="Worker" subtitle={workerId} gradient={["#6366f1", "#8b5cf6", "#ec4899"]} refreshing={loading} onRefresh={load}>
      {loading && !personal ? (
        <ActivityIndicator color="#6366f1" />
      ) : (
        <>
          <SectionTitle title="Personal details" />
          <Card>
            <Text style={styles.label}>Name</Text>
            <TextInput value={name} onChangeText={setName} {...inputProps} />

            <Text style={styles.label}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" {...inputProps} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Country code</Text>
                <TextInput value={contactCountryCode} onChangeText={setContactCountryCode} autoCapitalize="none" {...inputProps} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>Contact</Text>
                <TextInput value={contact} onChangeText={setContact} keyboardType="phone-pad" {...inputProps} />
              </View>
            </View>

            <Text style={styles.label}>Address</Text>
            <TextInput value={address} onChangeText={setAddress} multiline {...inputProps} style={[styles.input, styles.multiline]} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>District</Text>
                <TextInput value={district} onChangeText={setDistrict} {...inputProps} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>State code</Text>
                <TextInput value={state} onChangeText={setState} keyboardType="numeric" {...inputProps} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>City code</Text>
                <TextInput value={city} onChangeText={setCity} keyboardType="numeric" {...inputProps} />
              </View>
            </View>

            <Text style={styles.label}>Nationality (code)</Text>
            <TextInput value={nationality} onChangeText={setNationality} keyboardType="numeric" {...inputProps} />
          </Card>

          <SectionTitle title="Travel documents" />
          <Card>
            <Text style={styles.label}>Passport number</Text>
            <TextInput value={passportNumber} onChangeText={setPassportNumber} autoCapitalize="characters" {...inputProps} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Issue (YYYY-MM-DD)</Text>
                <TextInput value={passportIssue} onChangeText={setPassportIssue} autoCapitalize="none" {...inputProps} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Expiry (YYYY-MM-DD)</Text>
                <TextInput value={passportExpire} onChangeText={setPassportExpire} autoCapitalize="none" {...inputProps} />
              </View>
            </View>

            <Text style={styles.label}>Permit/visa expiry (YYYY-MM-DD)</Text>
            <TextInput value={permitExpire} onChangeText={setPermitExpire} autoCapitalize="none" {...inputProps} />
          </Card>

          <SectionTitle title="Demographics" />
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Gender</Text>
                <TextInput value={gender} onChangeText={setGender} {...inputProps} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DOB (YYYY-MM-DD)</Text>
                <TextInput value={dateOfBirth} onChangeText={setDateOfBirth} autoCapitalize="none" {...inputProps} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Marital status (code)</Text>
                <TextInput value={maritalStatus} onChangeText={setMaritalStatus} keyboardType="numeric" {...inputProps} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Education</Text>
                <TextInput value={highestEducation} onChangeText={setHighestEducation} {...inputProps} />
              </View>
            </View>

            <Text style={styles.label}>Mother name</Text>
            <TextInput value={motherName} onChangeText={setMotherName} {...inputProps} />

            <Text style={styles.label}>Father name</Text>
            <TextInput value={fatherName} onChangeText={setFatherName} {...inputProps} />
          </Card>

          {canEdit ? (
            <PrimaryButton title={busy ? "Saving…" : "Save changes"} loading={busy} onPress={save} style={{ marginTop: 18 }} />
          ) : null}

          <Text style={styles.cancel} onPress={() => router.back()}>Back</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 12, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
    paddingHorizontal: 12, marginTop: 8, backgroundColor: "#ffffff", color: "#0f172a",
  },
  multiline: { height: 90, paddingTop: 10, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  cancel: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});

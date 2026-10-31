// @ts-nocheck
import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

function getAttributeValue(key) {
  try {
    const attributes = shopify.attributes?.value || [];
    const attr = attributes.find((a) => a.key === key);
    return attr?.value || null;
  } catch {
    return null;
  }
}

async function updateAttribute(key, value) {
  try {
    if (shopify.instructions?.value?.attributes?.canUpdateAttributes === false) {
      return false;
    }
    await shopify.applyAttributeChange({
      key,
      type: "updateAttribute",
      value,
    });
    return true;
  } catch (err) {
    return false;
  }
}


const API_URL = "https://fabindia-asm.vercel.app/api/employee-list";


function Extension() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  const storeCode = getAttributeValue("store_code");
  const isEmployeeIdentified = Boolean(storeCode);

  const showToAllCustomers = shopify.settings?.value?.show_to_all_customers === true;
  const fallbackStoreCode = shopify.settings?.value?.fallback_store_code || "";
  const effectiveStoreCode = storeCode || (showToAllCustomers ? fallbackStoreCode : "");

  // ── BLOCK PROGRESS VALIDATION ──
  useEffect(() => {
    if (!shopify || !shopify.buyerJourney) return;

    let cancelled = false;
    let teardown;

    shopify.buyerJourney
      .intercept(({ canBlockProgress }) => {
        if (effectiveStoreCode && !selected) {
          return canBlockProgress
            ? {
                behavior: "block",
                reason: "Employee ID selection is required",
              }
            : { behavior: "allow" };
        }
        return { behavior: "allow" };
      })
      .then((fn) => {
        if (cancelled) {
          fn?.();
        } else {
          teardown = fn;
        }
      });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [selected, effectiveStoreCode]);

  // Fetch employee list
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const existing = getAttributeValue("employee_id");
      if (existing) setSelected(existing);

      if (!effectiveStoreCode) {
        if (!cancelled) {
          setLoading(false);
          setIsInitialized(true);
        }
        return;
      }

      try {
  const res = await fetch(API_URL, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ store_code: effectiveStoreCode }),
  });

  if (res.status === 401) throw new Error("Authentication failed");
  if (!res.ok) throw new Error(`Server error: ${res.status}`);

  const data = await res.json();

  if (!data.success) throw new Error(data.error || "API failed");

  if (!cancelled) setEmployees(data.employee_list || []);
} catch (err) {
        if (!cancelled) {
          setError(
            err.message === "Failed to fetch"
              ? "Employee list load nahi ho payi — server ne request block kar di (CORS/preflight issue). Please check server config."
              : "Employee list load nahi ho payi. Please retry."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [effectiveStoreCode]);

  const handleSelect = async (value) => {
    setSelected(value);

    // employee_id set karo
    await updateAttribute("employee_id", value);

    // additional-info set karo → format: E13660-Anas Hafeez-BP1015
    if (value && effectiveStoreCode) {
      const emp = employees.find((e) => e.employee_id === value);
      const empName = emp?.employee_name || "";
      const additionalInfo = `${value}-${empName}-${effectiveStoreCode}`;
      await updateAttribute("additional-info", additionalInfo);
    } else {
      await updateAttribute("additional-info", "");
    }
  };

  if (!shopify || !shopify.instructions) return null;
  if (!isEmployeeIdentified && !showToAllCustomers) return null;

  if (!isInitialized || loading) {
    return (
      <s-banner heading="Select Id">
        <s-text>Loading employee list...</s-text>
      </s-banner>
    );
  }

  if (!effectiveStoreCode) {
    return (
      <s-banner heading="Select Id" tone="warning">
        <s-text>⚠️ The store code was not found in the cart. Please check the employee login.</s-text>
      </s-banner>
    );
  }

  if (error) {
    return (
      <s-banner heading="Select Id" tone="critical">
        <s-text>{error}</s-text>
      </s-banner>
    );
  }

  if (employees.length === 0) {
    return (
      <s-banner heading="Select Id" tone="warning">
        <s-text>No employees found for this store.</s-text>
      </s-banner>
    );
  }

  return (
    <s-banner heading="Select Id">
      <s-stack gap="base">
        <s-select
          label="Employee Id *"
          value={selected}
          required={true}
          onChange={(e) => {
            const value = e.target?.value;
            if (value) {
              handleSelect(value);
            } else {
              setSelected("");
              updateAttribute("employee_id", "");
              updateAttribute("additional-info", "");
            }
          }}
        >
          <s-option value="">Choose an employee</s-option>
          {employees.map((emp) => (
            <s-option key={emp.employee_id} value={emp.employee_id}>
              {emp.employee_id} - {emp.employee_name}
            </s-option>
          ))}
        </s-select>

        {!selected && (
          <s-text tone="critical">
            ⚠️ Please select an employee ID to continue.
          </s-text>
        )}
      </s-stack>
    </s-banner>
  );
}
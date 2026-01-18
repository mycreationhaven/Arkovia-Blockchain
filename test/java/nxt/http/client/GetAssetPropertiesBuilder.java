/*
 * Copyright © 2016-2023 Jelurida IP B.V.
 * Copyright © 2023-2025 Jelurida Swiss SA
 *
 * See the LICENSE.txt file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida
 * Swiss SA, no part of this software, including this file, may be copied,
 * modified, propagated, or distributed except according to the terms
 * contained in the LICENSE.txt file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

package nxt.http.client;

import nxt.Tester;
import nxt.http.APICall;
import org.json.simple.JSONObject;

public class GetAssetPropertiesBuilder {
    private final APICall.Builder builder;

    public GetAssetPropertiesBuilder(long assetId) {
        builder = new APICall.Builder("getAssetProperties")
                .param("asset", Long.toUnsignedString(assetId));
    }

    public GetAssetPropertiesBuilder setter(Tester setter) {
        builder.param("setter", setter.getStrId());
        return this;
    }

    public JSONObject invokeNoError() {
        return builder.build().invokeNoError();
    }
}

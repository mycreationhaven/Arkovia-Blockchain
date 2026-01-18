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

package nxt.env;

public class AndroidDirProvider extends DesktopUserDirProvider {
    /**
     * This value is injected by com.jelurida.mobile.ardor.MainActivity
     */
    private static String homeDir;

    public static void setHomeDir(String homeDir) {
        AndroidDirProvider.homeDir = homeDir;
    }

    @Override
    public String getUserHomeDir() {
        if (homeDir == null) {
            throw new IllegalStateException("Home dir value was not injected properly");
        }
        return homeDir;
    }
}